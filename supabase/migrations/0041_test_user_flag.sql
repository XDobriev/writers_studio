-- is_test flag for profiles: exclude test/demo accounts from revenue stats.

-- 1. Add is_test column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- 2. get_admin_revenue — исключает is_test = true из всех счётчиков
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
    AND (plan_expires_at IS NULL OR plan_expires_at > now())
    AND NOT is_test;

  SELECT COUNT(*) INTO v_lifetime_count
  FROM public.profiles
  WHERE plan = 'lifetime'
    AND NOT is_test;

  SELECT COUNT(*) INTO v_churn_count
  FROM public.admin_audit_log l
  JOIN public.profiles p ON p.user_id = l.target_user_id
  WHERE l.action = 'set_plan'
    AND l.payload->>'old_plan' = 'pro'
    AND l.payload->>'new_plan' = 'free'
    AND l.created_at >= now() - interval '30 days'
    AND NOT p.is_test;

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

-- 3. get_admin_users — добавляет поле is_test в возврат
DROP FUNCTION IF EXISTS public.get_admin_users();

CREATE FUNCTION public.get_admin_users()
RETURNS TABLE(
  id          uuid,
  email       text,
  created_at  timestamptz,
  books_count bigint,
  words_total bigint,
  last_active date,
  plan        text,
  suspended   boolean,
  is_test     boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_email text;
BEGIN
  SELECT value INTO v_admin_email FROM public.app_config WHERE key = 'admin_email';
  IF (auth.jwt() ->> 'email') IS DISTINCT FROM v_admin_email THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    u.created_at,
    COUNT(DISTINCT b.id)::bigint                             AS books_count,
    COALESCE(SUM(b.words), 0)::bigint                        AS words_total,
    MAX(ws.date)                                             AS last_active,
    COALESCE(p.plan, 'free')::text                           AS plan,
    (u.banned_until IS NOT NULL AND u.banned_until > now())  AS suspended,
    COALESCE(p.is_test, false)                               AS is_test
  FROM auth.users u
  LEFT JOIN public.books b              ON b.user_id = u.id
  LEFT JOIN public.writing_snapshots ws ON ws.user_id = u.id
  LEFT JOIN public.profiles p           ON p.user_id = u.id
  GROUP BY u.id, u.email, u.created_at, p.plan, u.banned_until, p.is_test
  ORDER BY u.created_at DESC;
END;
$$;

-- 4. set_user_test — помечает/снимает метку тестового пользователя
CREATE OR REPLACE FUNCTION public.set_user_test(
  target_user_id uuid,
  is_test_value  boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_email  text;
  v_caller_id    uuid;
  v_target_email text;
BEGIN
  SELECT value INTO v_admin_email FROM public.app_config WHERE key = 'admin_email';
  IF (auth.jwt() ->> 'email') IS DISTINCT FROM v_admin_email THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  v_caller_id := auth.uid();

  SELECT email INTO v_target_email FROM auth.users WHERE id = target_user_id;
  IF v_target_email IS NULL THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.profiles
  SET is_test = is_test_value
  WHERE user_id = target_user_id;

  INSERT INTO public.admin_audit_log (admin_id, admin_email, action, target_user_id, payload)
  VALUES (
    v_caller_id,
    v_admin_email,
    CASE WHEN is_test_value THEN 'mark_test' ELSE 'unmark_test' END,
    target_user_id,
    jsonb_build_object('email', v_target_email)
  );
END;
$$;
