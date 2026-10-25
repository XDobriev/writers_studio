-- L-8: поздний успех отклонённого автосписания не продлевает Pro второй раз.
--
-- Робокасса (поддержка, 25.10.2026): банк может сначала отказать (State 10), а позже дослать
-- успех — операция станет оплаченной и придёт ResultURL; срока нет, отменить дочернюю
-- операцию через API нельзя. Повтор через сутки идёт с новым InvoiceID, поэтому за один
-- период могут пройти оба списания.
--
-- payments.for_expiry — plan_expires_at, который продлевает этот дочерний счёт
-- (пишет billing-scheduler). Дочерний платёж — дубль, если к его подтверждению:
--   * period_already_paid — plan_expires_at уже не тот: период оплатил другой дочерний счёт,
--     обычная оплата новой картой, его срезал возврат или поменял админ;
--   * subscription_inactive — подписки, которую он продлевал, нет: Free/Lifetime,
--     рекуррент закрыт (recurring_inv_id = NULL) или автопродление отменено.
-- Дубль подписку не трогает, получает duplicate_reason и audit recurring_duplicate;
-- robokassa-webhook возвращает его по op_key (Refund/Create) и уведомляет владельца.
-- apply_refund для дубля запрещён: он снял бы период, который дубль не продлевал.
-- Строки без for_expiry (созданы до этой миграции) проверяются только на subscription_inactive.
--
-- ROLLBACK:
--   CREATE OR REPLACE activate_payment / apply_refund / get_admin_revenue из
--   20261022000200_billing_core.sql и текущего прода (get_admin_revenue — без фильтра
--   duplicate_reason), затем
--   ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_duplicate_reason_check,
--     DROP COLUMN IF EXISTS duplicate_reason, DROP COLUMN IF EXISTS for_expiry;
--   Старые edge-функции с новыми колонками не конфликтуют.

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS for_expiry timestamptz;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS duplicate_reason text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_duplicate_reason_check') THEN
    ALTER TABLE public.payments ADD CONSTRAINT payments_duplicate_reason_check
      CHECK (duplicate_reason IN ('period_already_paid', 'subscription_inactive'));
  END IF;
END $$;

-- ─── activate_payment ────────────────────────────────────────────────────────
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
  v_dup      text;
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

  IF v_pay.source = 'recurring' THEN
    v_dup := CASE
      WHEN v_prof.plan <> 'pro' OR v_prof.recurring_inv_id IS NULL OR v_prof.cancel_at_period_end
        THEN 'subscription_inactive'
      WHEN v_pay.for_expiry IS NOT NULL AND v_prof.plan_expires_at IS DISTINCT FROM v_pay.for_expiry
        THEN 'period_already_paid'
    END;
    IF v_dup IS NOT NULL THEN
      UPDATE public.payments SET duplicate_reason = v_dup WHERE id = v_pay.id;
      INSERT INTO public.admin_audit_log (admin_id, admin_email, action, target_user_id, payload)
      VALUES (c_system, 'system', 'recurring_duplicate', p_user_id,
              jsonb_build_object('inv_id', p_inv_id, 'amount', p_amount::text, 'plan', p_plan,
                                 'reason', v_dup, 'for_expiry', v_pay.for_expiry,
                                 'profile_plan', v_prof.plan, 'plan_expires_at', v_prof.plan_expires_at));
      RETURN jsonb_build_object('status', 'duplicate_period', 'reason', v_dup, 'source', v_pay.source);
    END IF;
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
      -- (до 20261022000200): тогда Recurring ставился всегда, считаем мандат есть.
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

-- ─── apply_refund: дубль сюда не попадает ────────────────────────────────────
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
  IF EXISTS (SELECT 1 FROM public.payments WHERE id = p_payment_id AND duplicate_reason IS NOT NULL) THEN
    RAISE EXCEPTION 'duplicate_payment_not_applicable' USING ERRCODE = '22023';
  END IF;

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

-- ─── get_admin_revenue: дубль не считается ценой подписки в MRR ─────────────
CREATE OR REPLACE FUNCTION public.get_admin_revenue()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_pro_count        bigint;
  v_lifetime_count   bigint;
  v_cancelling_count bigint;
  v_mrr              numeric;
  v_churn_count      bigint;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  WITH active_pro AS (
    SELECT p.user_id, p.cancel_at_period_end
      FROM public.profiles p
     WHERE p.plan = 'pro'
       AND (p.plan_expires_at IS NULL OR p.plan_expires_at > now())
       AND NOT p.is_test
  ), last_pay AS (
    SELECT DISTINCT ON (pay.user_id) pay.user_id, pay.amount, pay.plan
      FROM public.payments pay
      JOIN active_pro a ON a.user_id = pay.user_id
     WHERE pay.confirmed_at IS NOT NULL
       AND pay.refunded_at IS NULL
       AND pay.duplicate_reason IS NULL
       AND pay.plan IN ('pro', 'pro_annual')
     ORDER BY pay.user_id, pay.confirmed_at DESC
  )
  SELECT
    (SELECT count(*) FROM active_pro),
    (SELECT count(*) FROM active_pro WHERE cancel_at_period_end),
    COALESCE((SELECT sum(CASE WHEN lp.plan = 'pro_annual' THEN lp.amount / 12 ELSE lp.amount END) FROM last_pay lp), 0)
  INTO v_pro_count, v_cancelling_count, v_mrr;

  SELECT count(*) INTO v_lifetime_count
    FROM public.profiles WHERE plan = 'lifetime' AND NOT is_test;

  SELECT count(DISTINCT l.target_user_id) INTO v_churn_count
    FROM public.admin_audit_log l
    LEFT JOIN public.profiles p ON p.user_id = l.target_user_id
   WHERE l.created_at >= now() - interval '30 days'
     AND COALESCE(p.is_test, false) = false
     AND (
       l.action IN ('subscription_expired', 'subscription_lapsed')
       OR (l.action = 'refund_processed' AND l.payload ->> 'new_plan' = 'free')
       OR (l.action = 'set_plan' AND l.payload ->> 'old_plan' = 'pro' AND l.payload ->> 'new_plan' = 'free')
     );

  RETURN json_build_object(
    'mrr',              round(v_mrr),
    'arr',              round(v_mrr * 12),
    'pro_count',        v_pro_count,
    'lifetime_count',   v_lifetime_count,
    'cancelling_count', v_cancelling_count,
    'churn_count_30d',  v_churn_count,
    'churn_rate',       CASE
      WHEN (v_pro_count + v_churn_count) > 0
      THEN ROUND((v_churn_count::numeric / (v_pro_count + v_churn_count) * 100), 1)
      ELSE 0
    END
  );
END;
$$;
