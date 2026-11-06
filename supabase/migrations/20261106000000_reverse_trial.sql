-- G-8: 7-дневный Reverse Trial тарифа Pro в 1 клик без привязки карты.
--
-- 1. Колонки profiles: trial_started_at, trial_ends_at, trial_used.
-- 2. public.is_paid(uuid): учитывает активный триал (trial_ends_at > now()).
--    Биллинг (get_billing_due, downgrade_expired_subscriptions, get_admin_revenue)
--    смотрит на plan = 'pro', поэтому триал не попадает в автосписания и MRR.
-- 3. public.start_pro_trial(): SECURITY DEFINER RPC для authenticated —
--    включает 7 дней триала ровно 1 раз на аккаунт и пишет trial_started в admin_audit_log.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.start_pro_trial();
--   -- вернуть public.is_paid из 20261022000200_billing_core.sql
--   ALTER TABLE public.profiles
--     DROP COLUMN IF EXISTS trial_started_at,
--     DROP COLUMN IF EXISTS trial_ends_at,
--     DROP COLUMN IF EXISTS trial_used;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_used boolean NOT NULL DEFAULT false;

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
        OR (p.trial_ends_at IS NOT NULL AND p.trial_ends_at > now())
      FROM public.profiles p
     WHERE p.user_id = p_user_id
  ), false);
$$;

REVOKE ALL ON FUNCTION public.is_paid(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_paid(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.start_pro_trial()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  c_system constant uuid := '00000000-0000-0000-0000-000000000000';
  v_uid    uuid := auth.uid();
  v_prof   public.profiles%ROWTYPE;
  v_now    timestamptz := now();
  v_ends   timestamptz := v_now + interval '7 days';
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_prof FROM public.profiles WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_prof.plan = 'lifetime'
     OR (v_prof.plan = 'pro' AND (v_prof.plan_expires_at IS NULL OR v_prof.plan_expires_at > v_now))
  THEN
    RAISE EXCEPTION 'already_paid' USING ERRCODE = 'P0001';
  END IF;

  IF v_prof.trial_used OR v_prof.trial_started_at IS NOT NULL THEN
    RAISE EXCEPTION 'trial_already_used' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.profiles
     SET trial_started_at = v_now,
         trial_ends_at    = v_ends,
         trial_used       = true
   WHERE user_id = v_uid;

  INSERT INTO public.admin_audit_log (admin_id, admin_email, action, target_user_id, payload)
  VALUES (c_system, 'system', 'trial_started', v_uid,
          jsonb_build_object('trial_started_at', v_now, 'trial_ends_at', v_ends));

  RETURN jsonb_build_object(
    'trial_started_at', v_now,
    'trial_ends_at', v_ends,
    'trial_used', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.start_pro_trial() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_pro_trial() TO authenticated, service_role;
