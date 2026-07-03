-- L11 tail: remove inert `v_admin_email` from admin read-only RPCs.
-- After the guard was swapped to `NOT public.is_admin()`, the line
-- `SELECT ... INTO v_admin_email FROM app_config` became dead in the 8 getters
-- (value never used). The 6 mutation RPCs still use v_admin_email for the
-- admin_audit_log.admin_email column and are intentionally left untouched.

CREATE OR REPLACE FUNCTION public.get_admin_anomalies()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT json_build_object(
      'no_books', (
        SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
        FROM (
          SELECT u.id, u.email::text, u.created_at
          FROM auth.users u
          WHERE u.created_at < NOW() - INTERVAL '7 days'
            AND NOT EXISTS (SELECT 1 FROM public.books b WHERE b.user_id = u.id)
          ORDER BY u.created_at DESC
          LIMIT 20
        ) t
      ),
      'inactive_60d', (
        SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
        FROM (
          SELECT
            u.id,
            u.email::text,
            u.created_at,
            MAX(ws.date) AS last_active
          FROM auth.users u
          LEFT JOIN public.writing_snapshots ws ON ws.user_id = u.id
          WHERE u.created_at < NOW() - INTERVAL '60 days'
          GROUP BY u.id, u.email
          HAVING MAX(ws.date) < CURRENT_DATE - 60 OR MAX(ws.date) IS NULL
          ORDER BY MAX(ws.date) ASC NULLS FIRST
          LIMIT 20
        ) t
      )
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_audit_log()
 RETURNS TABLE(id uuid, action text, target_user_id uuid, target_email text, payload jsonb, created_at timestamp with time zone, is_test boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.action,
    l.target_user_id,
    u.email::text AS target_email,
    l.payload,
    l.created_at,
    COALESCE(p.is_test, false) AS is_test
  FROM public.admin_audit_log l
  LEFT JOIN auth.users u      ON u.id = l.target_user_id
  LEFT JOIN public.profiles p ON p.user_id = l.target_user_id
  ORDER BY l.created_at DESC
  LIMIT 200;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_dau_trend()
 RETURNS TABLE(day date, dau bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    ws.date AS day,
    COUNT(DISTINCT ws.user_id)::bigint AS dau
  FROM public.writing_snapshots ws
  WHERE ws.date >= CURRENT_DATE - 29
  GROUP BY ws.date
  ORDER BY ws.date;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_retention()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_eligible_7d  bigint;
  v_active_7d    bigint;
  v_eligible_30d bigint;
  v_active_30d   bigint;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_eligible_7d  FROM auth.users WHERE created_at < NOW() - INTERVAL '7 days';
  SELECT COUNT(DISTINCT user_id) INTO v_active_7d
    FROM public.writing_snapshots
    WHERE date >= CURRENT_DATE - 7
      AND user_id IN (SELECT id FROM auth.users WHERE created_at < NOW() - INTERVAL '7 days');

  SELECT COUNT(*) INTO v_eligible_30d FROM auth.users WHERE created_at < NOW() - INTERVAL '30 days';
  SELECT COUNT(DISTINCT user_id) INTO v_active_30d
    FROM public.writing_snapshots
    WHERE date >= CURRENT_DATE - 30
      AND user_id IN (SELECT id FROM auth.users WHERE created_at < NOW() - INTERVAL '30 days');

  RETURN json_build_object(
    'eligible_7d',  v_eligible_7d,
    'active_7d',    v_active_7d,
    'eligible_30d', v_eligible_30d,
    'active_30d',   v_active_30d
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_revenue()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pro_count      bigint;
  v_lifetime_count bigint;
  v_churn_count    bigint;
BEGIN
  IF NOT public.is_admin() THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_stats()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT json_build_object(
      'users_total',    (SELECT COUNT(*) FROM auth.users),
      'users_7d',       (SELECT COUNT(*) FROM auth.users WHERE created_at >= NOW() - INTERVAL '7 days'),
      'users_30d',      (SELECT COUNT(*) FROM auth.users WHERE created_at >= NOW() - INTERVAL '30 days'),
      'books_total',    (SELECT COUNT(*) FROM public.books),
      'chapters_total', (SELECT COUNT(*) FROM public.chapters),
      'words_total',    (SELECT COALESCE(SUM(words), 0) FROM public.books),
      'dau',            (SELECT COUNT(DISTINCT user_id) FROM public.writing_snapshots WHERE date = CURRENT_DATE),
      'wau',            (SELECT COUNT(DISTINCT user_id) FROM public.writing_snapshots WHERE date >= CURRENT_DATE - INTERVAL '7 days'),
      'mau',            (SELECT COUNT(DISTINCT user_id) FROM public.writing_snapshots WHERE date >= CURRENT_DATE - INTERVAL '30 days'),
      'snapshots_30d',  (SELECT COUNT(*) FROM public.writing_snapshots WHERE date >= CURRENT_DATE - INTERVAL '30 days')
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_user_detail(target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'books', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',             b.id,
        'title',          b.title,
        'chapters_count', (SELECT count(*) FROM public.chapters c WHERE c.book_id = b.id),
        'words_total',    COALESCE((SELECT sum(c.words_count) FROM public.chapters c WHERE c.book_id = b.id), 0)
      ) ORDER BY b.created_at DESC)
      FROM public.books b WHERE b.user_id = target_user_id
    ), '[]'::jsonb),
    'plan_history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'action',     l.action,
        'payload',    l.payload,
        'created_at', l.created_at
      ) ORDER BY l.created_at DESC)
      FROM public.admin_audit_log l
      WHERE l.target_user_id = get_admin_user_detail.target_user_id
    ), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_users()
 RETURNS TABLE(id uuid, email text, created_at timestamp with time zone, books_count bigint, words_total bigint, last_active date, plan text, suspended boolean, is_test boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
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
$function$;
