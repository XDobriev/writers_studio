CREATE OR REPLACE FUNCTION public.get_admin_dau_trend()
RETURNS TABLE(day date, dau bigint)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
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
    ws.date AS day,
    COUNT(DISTINCT ws.user_id)::bigint AS dau
  FROM public.writing_snapshots ws
  WHERE ws.date >= CURRENT_DATE - 29
  GROUP BY ws.date
  ORDER BY ws.date;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_retention()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_email text;
  v_eligible_7d  bigint;
  v_active_7d    bigint;
  v_eligible_30d bigint;
  v_active_30d   bigint;
BEGIN
  SELECT value INTO v_admin_email FROM public.app_config WHERE key = 'admin_email';
  IF (auth.jwt() ->> 'email') IS DISTINCT FROM v_admin_email THEN
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
$$;

CREATE OR REPLACE FUNCTION public.get_admin_anomalies()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_email text;
BEGIN
  SELECT value INTO v_admin_email FROM public.app_config WHERE key = 'admin_email';
  IF (auth.jwt() ->> 'email') IS DISTINCT FROM v_admin_email THEN
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
$$;
