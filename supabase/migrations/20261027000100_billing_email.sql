-- B-1: адрес для чеков и писем об оплате у пользователей Telegram/VK.
--
-- У них auth-email синтетический (*.local). Робокасса (поддержка, 25.10.2026): email в
-- Receipt можно не передавать — страница оплаты сама спросит адрес; чек дочернего
-- списания без email уходит на адрес материнской оплаты. ResultURL присылает EMail —
-- адрес, введённый при оплате; robokassa-webhook сохраняет его сюда (только доставляемый).
-- Наши письма (подтверждение оплаты, напоминание о списании, неудачное списание) идут на
-- auth-email, а если он недоставляем — на billing_email (_shared/email.ts contactEmail).
--
-- Права: SELECT по profiles уже у authenticated (RLS — своя строка), UPDATE — только по
-- колонкам onboarded_at/display_name (20260702_profiles_lock_privileged_columns), поэтому
-- billing_email пишет только service_role; отдельный GRANT не нужен.
--
-- get_billing_due / get_renewal_reminders_due отдают billing_email (меняется тип
-- результата → DROP + CREATE). Фильтр «не *.local» у напоминаний переехал в scheduler:
-- строку отдаём, если доставляемый хотя бы один адрес.
--
-- ROLLBACK:
--   DROP FUNCTION public.get_billing_due(integer); DROP FUNCTION public.get_renewal_reminders_due();
--   затем обе из 20261027000000_billing_skip_banned.sql;
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS billing_email;
--   Старый billing-scheduler с новыми функциями работает (лишний столбец не читает),
--   но напоминания Telegram/VK отбросит сам по isDeliverableEmail.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS billing_email text;

DROP FUNCTION IF EXISTS public.get_billing_due(integer);
CREATE FUNCTION public.get_billing_due(p_max_attempts integer DEFAULT 4)
RETURNS TABLE (
  user_id            uuid,
  email              text,
  billing_email      text,
  plan_expires_at    timestamptz,
  recurring_inv_id   text,
  grandfathered      boolean,
  plan_interval      text,
  is_retry           boolean,
  billing_attempts   integer,
  pending_inv_id     text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p.user_id,
         u.email::text,
         p.billing_email,
         p.plan_expires_at,
         p.recurring_inv_id,
         p.grandfathered,
         p.plan_interval,
         (p.last_billed_expiry IS NOT DISTINCT FROM p.plan_expires_at) AS is_retry,
         p.billing_attempts,
         (SELECT pay.inv_id FROM public.payments pay
           WHERE pay.user_id = p.user_id AND pay.source = 'recurring' AND pay.confirmed_at IS NULL
           ORDER BY pay.paid_at DESC LIMIT 1) AS pending_inv_id
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.user_id
   WHERE p.plan = 'pro'
     AND p.cancel_at_period_end = false
     AND p.recurring_inv_id IS NOT NULL
     AND p.plan_expires_at IS NOT NULL
     AND (p.plan_expires_at AT TIME ZONE 'Europe/Moscow')::date <= (now() AT TIME ZONE 'Europe/Moscow')::date
     AND (u.banned_until IS NULL OR u.banned_until <= now())
     AND (
       p.last_billed_expiry IS DISTINCT FROM p.plan_expires_at
       OR (p.billing_attempts < p_max_attempts
           AND (p.last_billed_at IS NULL OR p.last_billed_at < now() - interval '20 hours'))
     )
   ORDER BY p.plan_expires_at;
$$;

REVOKE ALL ON FUNCTION public.get_billing_due(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_billing_due(integer) TO service_role;

DROP FUNCTION IF EXISTS public.get_renewal_reminders_due();
CREATE FUNCTION public.get_renewal_reminders_due()
RETURNS TABLE (
  user_id         uuid,
  email           text,
  billing_email   text,
  plan_expires_at timestamptz,
  plan_interval   text,
  grandfathered   boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p.user_id, u.email::text, p.billing_email, p.plan_expires_at, p.plan_interval, p.grandfathered
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
   WHERE p.plan = 'pro'
     AND p.cancel_at_period_end = false
     AND p.recurring_inv_id IS NOT NULL
     AND p.plan_expires_at > now()
     AND (p.plan_expires_at AT TIME ZONE 'Europe/Moscow')::date
         - (now() AT TIME ZONE 'Europe/Moscow')::date BETWEEN 1 AND 3
     AND p.renewal_reminder_sent_for IS DISTINCT FROM p.plan_expires_at
     AND (u.banned_until IS NULL OR u.banned_until <= now())
     AND (u.email IS NOT NULL OR p.billing_email IS NOT NULL);
$$;

REVOKE ALL ON FUNCTION public.get_renewal_reminders_due() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_renewal_reminders_due() TO service_role;
