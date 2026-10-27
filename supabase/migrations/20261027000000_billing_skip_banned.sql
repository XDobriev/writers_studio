-- L-7: заблокированного пользователя не списываем и не предупреждаем о списании.
--
-- suspend_user ставит только auth.users.banned_until; войти человек не может, а
-- get_billing_due его не видел — автосписания шли каждый период. Теперь:
--   * get_billing_due и claim_billing_attempt пропускают banned_until > now()
--     (claim — на случай блокировки между чтением очереди и захватом попытки);
--   * get_renewal_reminders_due не шлёт «через 3 дня спишем».
-- Подписка заблокированного дальше живёт по обычным правилам: без успешного списания
-- downgrade_expired_subscriptions понизит её до free после grace. Разблокировали
-- до конца grace — следующий прогон scheduler спишет как обычный повтор.
--
-- ROLLBACK: CREATE OR REPLACE трёх функций из 20261022000200_billing_core.sql.

CREATE OR REPLACE FUNCTION public.get_billing_due(p_max_attempts integer DEFAULT 4)
RETURNS TABLE (
  user_id            uuid,
  email              text,
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

CREATE OR REPLACE FUNCTION public.claim_billing_attempt(
  p_user_id      uuid,
  p_expiry       timestamptz,
  p_max_attempts integer DEFAULT 4
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_attempt integer;
BEGIN
  UPDATE public.profiles
     SET billing_attempts = CASE
           WHEN last_billed_expiry IS DISTINCT FROM plan_expires_at THEN 1
           ELSE billing_attempts + 1
         END,
         last_billed_expiry = plan_expires_at,
         last_billed_at = now()
   WHERE user_id = p_user_id
     AND plan = 'pro'
     AND cancel_at_period_end = false
     AND recurring_inv_id IS NOT NULL
     AND plan_expires_at = p_expiry
     AND NOT EXISTS (
       SELECT 1 FROM auth.users u
        WHERE u.id = p_user_id AND u.banned_until > now()
     )
     AND (
       last_billed_expiry IS DISTINCT FROM plan_expires_at
       OR (billing_attempts < p_max_attempts
           AND (last_billed_at IS NULL OR last_billed_at < now() - interval '20 hours'))
     )
  RETURNING billing_attempts INTO v_attempt;
  RETURN v_attempt;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_billing_attempt(uuid, timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_billing_attempt(uuid, timestamptz, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.get_renewal_reminders_due()
RETURNS TABLE (
  user_id         uuid,
  email           text,
  plan_expires_at timestamptz,
  plan_interval   text,
  grandfathered   boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p.user_id, u.email::text, p.plan_expires_at, p.plan_interval, p.grandfathered
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
     AND u.email IS NOT NULL
     AND u.email !~* '\.local$';
$$;

REVOKE ALL ON FUNCTION public.get_renewal_reminders_due() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_renewal_reminders_due() TO service_role;
