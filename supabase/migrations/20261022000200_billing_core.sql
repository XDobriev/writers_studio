-- Ядро биллинга: единый источник «Pro активен», атомарная активация платежа,
-- атомарный захват цикла списания, dunning, понижение истёкших, возврат.
--
-- Модель (решения владельца 2026-10-22):
--   * Pro активен = plan='lifetime' ИЛИ (plan='pro' И (plan_expires_at IS NULL ИЛИ plan_expires_at > now())).
--     NULL у pro = бессрочный ручной грант админа (docs/features/payments.md: «null = бессрочно»).
--   * Продление: +1 календарный месяц / +1 год от текущего окончания, если подписка
--     ещё активна, иначе от момента оплаты (interval '1 month' в Postgres — календарный).
--   * Рекуррент: в день окончания периода (дата по Москве). Не прошло — повтор раз в сутки,
--     всего до 4 попыток (день окончания + 3 дня). Затем понижение до free.
--   * Отменённая подписка (cancel_at_period_end) понижается сразу по истечении, без grace.
--   * При понижении и при возврате сбрасываются recurring_inv_id, интервал-маркеры
--     и grandfathered (ранняя цена действует только на срок подписки).
--
-- Все функции SECURITY DEFINER, search_path зафиксирован, EXECUTE — только service_role
-- (вызывают edge-функции robokassa-webhook, billing-scheduler, process-refund).
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.activate_payment(text, uuid, text, numeric, boolean);
--   DROP FUNCTION IF EXISTS public.get_billing_due(integer);
--   DROP FUNCTION IF EXISTS public.claim_billing_attempt(uuid, timestamptz, integer);
--   DROP FUNCTION IF EXISTS public.get_renewal_reminders_due();
--   DROP FUNCTION IF EXISTS public.claim_renewal_reminder(uuid, timestamptz);
--   DROP FUNCTION IF EXISTS public.release_renewal_reminder(uuid, timestamptz);
--   DROP FUNCTION IF EXISTS public.downgrade_expired_subscriptions(interval);
--   DROP FUNCTION IF EXISTS public.apply_refund(uuid, text);
--   DROP FUNCTION IF EXISTS public.is_paid(uuid);  -- только после отката 20261022000400/000500
--   ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_source_check,
--     DROP COLUMN IF EXISTS source, DROP COLUMN IF EXISTS recurring;
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS billing_attempts,
--     DROP COLUMN IF EXISTS last_billed_at, DROP COLUMN IF EXISTS renewal_reminder_sent_for;
--   Старые edge-функции (robokassa-webhook v34, billing-scheduler, process-refund v18) с этими
--   колонками не конфликтуют: лишние колонки они не читают.

-- ─── Колонки ─────────────────────────────────────────────────────────────────
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'checkout';
-- Был ли у checkout-счёта флаг Recurring (= есть согласие и мандат). NULL — старые строки.
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS recurring boolean;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_source_check') THEN
    ALTER TABLE public.payments ADD CONSTRAINT payments_source_check CHECK (source IN ('checkout', 'recurring'));
  END IF;
END $$;

-- Бэкфилл: строки, пред-созданные scheduler'ом, видны по audit recurring_charge_initiated.
UPDATE public.payments p
   SET source = 'recurring'
  FROM public.admin_audit_log l
 WHERE l.action = 'recurring_charge_initiated'
   AND l.payload ->> 'inv_id' = p.inv_id
   AND p.source <> 'recurring';

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS billing_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_billed_at timestamptz;
-- plan_expires_at, о котором уже отправлено письмо-напоминание.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS renewal_reminder_sent_for timestamptz;

CREATE INDEX IF NOT EXISTS profiles_pro_expires_idx ON public.profiles (plan_expires_at) WHERE plan = 'pro';
CREATE INDEX IF NOT EXISTS payments_pending_recurring_idx ON public.payments (user_id, paid_at DESC)
  WHERE source = 'recurring' AND confirmed_at IS NULL;

-- ─── is_paid ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_paid(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE((
    SELECT p.plan = 'lifetime'
        OR (p.plan = 'pro' AND (p.plan_expires_at IS NULL OR p.plan_expires_at > now()))
      FROM public.profiles p
     WHERE p.user_id = p_user_id
  ), false);
$$;

REVOKE ALL ON FUNCTION public.is_paid(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_paid(uuid) TO service_role;

-- ─── activate_payment ────────────────────────────────────────────────────────
-- Одна транзакция: захват confirmed_at → (lifetime: слот) → профиль → audit.
-- Ошибка = откат всего, включая захват; повтор Робокассы переобработает платёж.
-- Повторная доставка того же InvId → status 'duplicate' без мутаций.
CREATE OR REPLACE FUNCTION public.activate_payment(
  p_inv_id      text,
  p_user_id     uuid,
  p_plan        text,
  p_amount      numeric,
  p_grandfather boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  c_system   constant uuid := '00000000-0000-0000-0000-000000000000';
  v_pay      public.payments%ROWTYPE;
  v_prof     public.profiles%ROWTYPE;
  v_slots    integer;
  v_oversold boolean := false;
  v_base     timestamptz;
  v_new_exp  timestamptz;
  v_mandate  boolean;
BEGIN
  IF p_plan NOT IN ('pro', 'pro_annual', 'lifetime') THEN
    RAISE EXCEPTION 'unknown_plan: %', p_plan USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.payments (inv_id, user_id, amount, plan, paid_at, source)
  VALUES (p_inv_id, p_user_id, p_amount, p_plan, now(), 'checkout')
  ON CONFLICT (inv_id) DO NOTHING;

  UPDATE public.payments
     SET confirmed_at = now(), amount = p_amount, plan = p_plan
   WHERE inv_id = p_inv_id AND confirmed_at IS NULL
  RETURNING * INTO v_pay;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'duplicate');
  END IF;

  IF v_pay.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'payment_user_mismatch' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_prof FROM public.profiles WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_plan = 'lifetime' THEN
    UPDATE public.app_settings
       SET value = (value::integer - 1)::text
     WHERE key = 'lifetime_slots_remaining' AND value::integer > 0
    RETURNING value::integer INTO v_slots;

    IF NOT FOUND THEN
      -- Деньги уже списаны: перепродать один слот лучше, чем держать чужие деньги без плана.
      v_oversold := true;
      INSERT INTO public.admin_audit_log (admin_id, admin_email, action, target_user_id, payload)
      VALUES (c_system, 'system', 'lifetime_oversold', p_user_id,
              jsonb_build_object('inv_id', p_inv_id, 'amount', p_amount));
    END IF;

    -- Lifetime закрывает рекуррент: recurring_inv_id = NULL, scheduler больше не спишет.
    UPDATE public.profiles
       SET plan = 'lifetime', plan_expires_at = NULL, cancel_at_period_end = false,
           recurring_inv_id = NULL, last_billed_expiry = NULL, billing_attempts = 0,
           last_billed_at = NULL, renewal_reminder_sent_for = NULL
     WHERE user_id = p_user_id;
    v_new_exp := NULL;

  ELSIF v_prof.plan = 'lifetime' THEN
    -- Pro поверх Lifetime (старая ссылка оплаты): Lifetime не понижаем, админ оформляет возврат.
    INSERT INTO public.admin_audit_log (admin_id, admin_email, action, target_user_id, payload)
    VALUES (c_system, 'system', 'payment_on_lifetime', p_user_id,
            jsonb_build_object('inv_id', p_inv_id, 'amount', p_amount, 'plan', p_plan));
    INSERT INTO public.admin_audit_log (admin_id, admin_email, action, target_user_id, payload)
    VALUES (c_system, 'system', 'payment_received', p_user_id,
            jsonb_build_object('amount', p_amount::text, 'plan', p_plan, 'inv_id', p_inv_id,
                               'provider', 'robokassa', 'source', v_pay.source, 'note', 'lifetime_kept'));
    RETURN jsonb_build_object('status', 'lifetime_kept', 'plan', 'lifetime', 'source', v_pay.source);

  ELSE
    v_base := CASE
      WHEN v_prof.plan = 'pro' AND v_prof.plan_expires_at IS NOT NULL AND v_prof.plan_expires_at > now()
        THEN v_prof.plan_expires_at
      ELSE now()
    END;
    v_new_exp := v_base + CASE WHEN p_plan = 'pro_annual' THEN interval '1 year' ELSE interval '1 month' END;

    IF v_pay.source = 'checkout' THEN
      -- Новый счёт = новый мандат: всегда перезаписываем родителя цепочки и интервал,
      -- сбрасываем маркеры прошлого цикла. NULL у recurring — строка старого формата
      -- (до этой миграции): тогда Recurring ставился всегда, считаем мандат есть.
      v_mandate := COALESCE(v_pay.recurring, true);
      UPDATE public.profiles
         SET plan = 'pro',
             plan_expires_at = v_new_exp,
             cancel_at_period_end = false,
             recurring_inv_id = CASE WHEN v_mandate THEN p_inv_id ELSE NULL END,
             plan_interval = CASE WHEN p_plan = 'pro_annual' THEN 'annual' ELSE 'monthly' END,
             last_billed_expiry = NULL,
             billing_attempts = 0,
             last_billed_at = NULL,
             renewal_reminder_sent_for = NULL,
             grandfathered = grandfathered OR COALESCE(p_grandfather, false)
       WHERE user_id = p_user_id;
    ELSE
      -- Дочерний рекуррентный платёж: продлеваем, цепочку и интервал не трогаем.
      UPDATE public.profiles
         SET plan = 'pro',
             plan_expires_at = v_new_exp,
             billing_attempts = 0,
             last_billed_at = NULL
       WHERE user_id = p_user_id;
    END IF;
  END IF;

  INSERT INTO public.admin_audit_log (admin_id, admin_email, action, target_user_id, payload)
  VALUES (c_system, 'system', 'payment_received', p_user_id,
          jsonb_build_object('amount', p_amount::text, 'plan', p_plan, 'inv_id', p_inv_id,
                             'provider', 'robokassa', 'source', v_pay.source,
                             'plan_expires_at', v_new_exp, 'oversold', v_oversold));

  RETURN jsonb_build_object(
    'status', 'activated',
    'plan', CASE WHEN p_plan = 'lifetime' THEN 'lifetime' ELSE 'pro' END,
    'plan_expires_at', v_new_exp,
    'source', v_pay.source,
    'oversold', v_oversold
  );
END;
$$;

REVOKE ALL ON FUNCTION public.activate_payment(text, uuid, text, numeric, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_payment(text, uuid, text, numeric, boolean) TO service_role;

-- ─── Кому списывать сегодня ──────────────────────────────────────────────────
-- В день окончания периода (по Москве) и в течение grace, пока есть попытки.
-- pending_inv_id — последний неподтверждённый дочерний счёт: перед повтором scheduler
-- спрашивает его статус у Робокассы (OpStateExt), чтобы не списать дважды.
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
     AND (
       p.last_billed_expiry IS DISTINCT FROM p.plan_expires_at
       OR (p.billing_attempts < p_max_attempts
           AND (p.last_billed_at IS NULL OR p.last_billed_at < now() - interval '20 hours'))
     )
   ORDER BY p.plan_expires_at;
$$;

REVOKE ALL ON FUNCTION public.get_billing_due(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_billing_due(integer) TO service_role;

-- Атомарный захват попытки ДО вызова Recurring. Два параллельных прогона не спишут
-- дважды: второй увидит обновлённые last_billed_expiry/last_billed_at и получит NULL.
-- p_expiry — plan_expires_at, прочитанный из get_billing_due: если webhook успел продлить
-- подписку между чтением и захватом, условие не совпадёт.
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

-- ─── Напоминание за 3 дня ────────────────────────────────────────────────────
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
     AND u.email IS NOT NULL
     AND u.email !~* '\.local$';
$$;

REVOKE ALL ON FUNCTION public.get_renewal_reminders_due() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_renewal_reminders_due() TO service_role;

CREATE OR REPLACE FUNCTION public.claim_renewal_reminder(p_user_id uuid, p_expiry timestamptz)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.profiles
     SET renewal_reminder_sent_for = plan_expires_at
   WHERE user_id = p_user_id
     AND plan_expires_at = p_expiry
     AND renewal_reminder_sent_for IS DISTINCT FROM plan_expires_at;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_renewal_reminder(p_user_id uuid, p_expiry timestamptz)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  UPDATE public.profiles
     SET renewal_reminder_sent_for = NULL
   WHERE user_id = p_user_id AND renewal_reminder_sent_for = p_expiry;
$$;

REVOKE ALL ON FUNCTION public.claim_renewal_reminder(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_renewal_reminder(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_renewal_reminder(uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_renewal_reminder(uuid, timestamptz) TO service_role;

-- ─── Понижение истёкших ──────────────────────────────────────────────────────
-- Не зависит ни от cancel_at_period_end, ни от флага recurring_billing_enabled.
--   * отменённые — сразу по истечении;
--   * неотменённые — после grace (по умолчанию 3 дня), если за последние 20 ч не было
--     попытки списания (её результат ещё может прийти webhook'ом).
-- plan_expires_at IS NULL (ручной бессрочный грант) не трогаем.
CREATE OR REPLACE FUNCTION public.downgrade_expired_subscriptions(p_grace interval DEFAULT interval '3 days')
RETURNS TABLE (user_id uuid, old_expires_at timestamptz, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN QUERY
  WITH d AS (
    UPDATE public.profiles p
       SET plan = 'free', plan_expires_at = NULL, cancel_at_period_end = false,
           recurring_inv_id = NULL, last_billed_expiry = NULL, billing_attempts = 0,
           last_billed_at = NULL, renewal_reminder_sent_for = NULL, grandfathered = false
      FROM public.profiles o
     WHERE o.user_id = p.user_id
       AND p.plan = 'pro'
       AND p.plan_expires_at IS NOT NULL
       AND (
         (p.cancel_at_period_end AND p.plan_expires_at < now())
         OR (p.plan_expires_at < now() - p_grace
             AND (p.last_billed_at IS NULL OR p.last_billed_at < now() - interval '20 hours'))
       )
    RETURNING p.user_id AS uid, o.plan_expires_at AS old_exp, o.cancel_at_period_end AS was_cancelled,
              o.billing_attempts AS attempts
  ), audit AS (
    INSERT INTO public.admin_audit_log (admin_id, admin_email, action, target_user_id, payload)
    SELECT '00000000-0000-0000-0000-000000000000'::uuid, 'system',
           CASE WHEN d.was_cancelled THEN 'subscription_expired' ELSE 'subscription_lapsed' END,
           d.uid,
           jsonb_build_object('plan_expires_at', d.old_exp, 'billing_attempts', d.attempts)
      FROM d
  )
  SELECT d.uid, d.old_exp, CASE WHEN d.was_cancelled THEN 'cancelled' ELSE 'payment_failed' END
    FROM d;
END;
$$;

REVOKE ALL ON FUNCTION public.downgrade_expired_subscriptions(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.downgrade_expired_subscriptions(interval) TO service_role;

-- ─── Возврат ─────────────────────────────────────────────────────────────────
-- Вызывается process-refund ПОСЛЕ одобрения Робокассой (refunded_at уже захвачен).
-- Снимает с plan_expires_at ровно оплаченный этим платежом период; если после этого
-- подписка ещё активна (был оплачен следующий период) — Pro остаётся до новой даты.
-- Рекуррент закрывается в любом случае (recurring_inv_id = NULL), ранняя цена сгорает.
CREATE OR REPLACE FUNCTION public.apply_refund(p_payment_id uuid, p_request_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_pay  public.payments%ROWTYPE;
  v_prof public.profiles%ROWTYPE;
  v_new  timestamptz;
  v_plan text;
BEGIN
  UPDATE public.payments SET refund_request_id = p_request_id
   WHERE id = p_payment_id AND refunded_at IS NOT NULL
  RETURNING * INTO v_pay;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'refund_not_claimed' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_prof FROM public.profiles WHERE user_id = v_pay.user_id FOR UPDATE;
  IF NOT FOUND OR v_prof.plan <> 'pro' THEN
    RETURN jsonb_build_object('plan', COALESCE(v_prof.plan, 'free'), 'plan_expires_at', v_prof.plan_expires_at);
  END IF;

  v_new := v_prof.plan_expires_at
         - CASE WHEN v_pay.plan = 'pro_annual' THEN interval '1 year' ELSE interval '1 month' END;

  IF v_prof.plan_expires_at IS NOT NULL AND v_new > now() THEN
    v_plan := 'pro';
    UPDATE public.profiles
       SET plan_expires_at = v_new, recurring_inv_id = NULL, cancel_at_period_end = false,
           last_billed_expiry = NULL, billing_attempts = 0, last_billed_at = NULL,
           renewal_reminder_sent_for = NULL, grandfathered = false
     WHERE user_id = v_pay.user_id;
  ELSE
    v_plan := 'free';
    v_new := NULL;
    UPDATE public.profiles
       SET plan = 'free', plan_expires_at = NULL, recurring_inv_id = NULL, cancel_at_period_end = false,
           last_billed_expiry = NULL, billing_attempts = 0, last_billed_at = NULL,
           renewal_reminder_sent_for = NULL, grandfathered = false
     WHERE user_id = v_pay.user_id;
  END IF;

  INSERT INTO public.admin_audit_log (admin_id, admin_email, action, target_user_id, payload)
  VALUES ('00000000-0000-0000-0000-000000000000', 'system', 'refund_processed', v_pay.user_id,
          jsonb_build_object('inv_id', v_pay.inv_id, 'amount', v_pay.amount, 'plan', v_pay.plan,
                             'request_id', p_request_id, 'new_plan', v_plan, 'new_expires_at', v_new));

  RETURN jsonb_build_object('plan', v_plan, 'plan_expires_at', v_new);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_refund(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_refund(uuid, text) TO service_role;
