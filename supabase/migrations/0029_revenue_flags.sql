-- Revenue metrics RPC + feature flags table.

-- 1. get_admin_revenue
CREATE OR REPLACE FUNCTION public.get_admin_revenue()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_email    text;
  v_pro_count      bigint;
  v_lifetime_count bigint;
  v_churn_count    bigint;
BEGIN
  SELECT value INTO v_admin_email FROM public.app_config WHERE key = 'admin_email';
  IF (auth.jwt() ->> 'email') IS DISTINCT FROM v_admin_email THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_pro_count
  FROM public.profiles
  WHERE plan = 'pro'
    AND (plan_expires_at IS NULL OR plan_expires_at > now());

  SELECT COUNT(*) INTO v_lifetime_count
  FROM public.profiles WHERE plan = 'lifetime';

  SELECT COUNT(*) INTO v_churn_count
  FROM public.admin_audit_log
  WHERE action = 'set_plan'
    AND payload->>'old_plan' = 'pro'
    AND payload->>'new_plan' = 'free'
    AND created_at >= now() - interval '30 days';

  RETURN json_build_object(
    'mrr',             v_pro_count * 390,
    'arr',             v_pro_count * 390 * 12,
    'pro_count',       v_pro_count,
    'lifetime_count',  v_lifetime_count,
    'churn_count_30d', v_churn_count,
    'churn_rate',      CASE
      WHEN (v_pro_count + v_churn_count) > 0
      THEN ROUND((v_churn_count::numeric / (v_pro_count + v_churn_count) * 100), 1)
      ELSE 0
    END
  );
END;
$$;

-- 2. feature_flags table
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key         text        PRIMARY KEY,
  enabled     boolean     NOT NULL DEFAULT false,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_flags select all"
  ON public.feature_flags FOR SELECT
  USING (true);

GRANT SELECT ON TABLE public.feature_flags TO anon, authenticated;

-- 3. get_feature_flags
CREATE OR REPLACE FUNCTION public.get_feature_flags()
RETURNS TABLE(key text, enabled boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT key, enabled FROM public.feature_flags ORDER BY key;
$$;

-- 4. set_feature_flag
CREATE OR REPLACE FUNCTION public.set_feature_flag(
  p_key     text,
  p_enabled boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_email text;
  v_caller_id   uuid;
  v_old_enabled boolean;
BEGIN
  SELECT value INTO v_admin_email FROM public.app_config WHERE key = 'admin_email';
  IF (auth.jwt() ->> 'email') IS DISTINCT FROM v_admin_email THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  v_caller_id := auth.uid();

  SELECT enabled INTO v_old_enabled
  FROM public.feature_flags WHERE key = p_key;

  INSERT INTO public.feature_flags (key, enabled, updated_at)
  VALUES (p_key, p_enabled, now())
  ON CONFLICT (key) DO UPDATE SET enabled = p_enabled, updated_at = now();

  INSERT INTO public.admin_audit_log (admin_id, admin_email, action, target_user_id, payload)
  VALUES (
    v_caller_id,
    v_admin_email,
    'set_feature_flag',
    NULL,
    jsonb_build_object('key', p_key, 'old_enabled', v_old_enabled, 'new_enabled', p_enabled)
  );
END;
$$;
