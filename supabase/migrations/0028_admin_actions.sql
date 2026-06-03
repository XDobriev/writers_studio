-- Admin panel extensions: suspend_user, extend_plan, set_lifetime_slots,
-- get_admin_user_detail, и обновление get_admin_users (+ suspended field).

-- 1. suspend_user — блокирует/разблокирует через auth.users.banned_until
CREATE OR REPLACE FUNCTION public.suspend_user(
  target_user_id uuid,
  suspend         boolean
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

  IF suspend THEN
    UPDATE auth.users SET banned_until = 'infinity' WHERE id = target_user_id;
  ELSE
    UPDATE auth.users SET banned_until = NULL WHERE id = target_user_id;
  END IF;

  INSERT INTO public.admin_audit_log (admin_id, admin_email, action, target_user_id, payload)
  VALUES (
    v_caller_id,
    v_admin_email,
    CASE WHEN suspend THEN 'suspend_user' ELSE 'unsuspend_user' END,
    target_user_id,
    jsonb_build_object('email', v_target_email)
  );
END;
$$;

-- 2. extend_plan — добавляет N дней Pro (от текущего истечения или от now())
CREATE OR REPLACE FUNCTION public.extend_plan(
  target_user_id uuid,
  days           integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_email text;
  v_caller_id   uuid;
  v_current_exp timestamptz;
  v_new_exp     timestamptz;
BEGIN
  SELECT value INTO v_admin_email FROM public.app_config WHERE key = 'admin_email';
  IF (auth.jwt() ->> 'email') IS DISTINCT FROM v_admin_email THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  v_caller_id := auth.uid();

  SELECT plan_expires_at INTO v_current_exp
  FROM public.profiles WHERE user_id = target_user_id;

  v_new_exp := GREATEST(COALESCE(v_current_exp, now()), now())
               + (days || ' days')::interval;

  UPDATE public.profiles
  SET plan = 'pro', plan_expires_at = v_new_exp
  WHERE user_id = target_user_id;

  INSERT INTO public.admin_audit_log (admin_id, admin_email, action, target_user_id, payload)
  VALUES (
    v_caller_id,
    v_admin_email,
    'extend_plan',
    target_user_id,
    jsonb_build_object('days', days, 'new_expires_at', v_new_exp)
  );
END;
$$;

-- 3. set_lifetime_slots — ручная корректировка счётчика Lifetime-слотов
CREATE OR REPLACE FUNCTION public.set_lifetime_slots(
  new_value integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_email text;
  v_caller_id   uuid;
  v_old_value   text;
BEGIN
  SELECT value INTO v_admin_email FROM public.app_config WHERE key = 'admin_email';
  IF (auth.jwt() ->> 'email') IS DISTINCT FROM v_admin_email THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  v_caller_id := auth.uid();

  SELECT value INTO v_old_value
  FROM public.app_settings WHERE key = 'lifetime_slots_remaining';

  UPDATE public.app_settings
  SET value = new_value::text
  WHERE key = 'lifetime_slots_remaining';

  INSERT INTO public.admin_audit_log (admin_id, admin_email, action, target_user_id, payload)
  VALUES (
    v_caller_id,
    v_admin_email,
    'set_lifetime_slots',
    NULL,
    jsonb_build_object('old_value', v_old_value, 'new_value', new_value)
  );
END;
$$;

-- 4. get_admin_user_detail — детальная карточка для /admin/users/:id
CREATE OR REPLACE FUNCTION public.get_admin_user_detail(
  target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_email text;
  v_result      jsonb;
BEGIN
  SELECT value INTO v_admin_email FROM public.app_config WHERE key = 'admin_email';
  IF (auth.jwt() ->> 'email') IS DISTINCT FROM v_admin_email THEN
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
$$;

-- 5. get_admin_users — пересоздаём с plan и suspended (старая версия без этих полей).
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
  suspended   boolean
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
    COUNT(DISTINCT b.id)::bigint                                AS books_count,
    COALESCE(SUM(b.words), 0)::bigint                           AS words_total,
    MAX(ws.date)                                                AS last_active,
    COALESCE(p.plan, 'free')::text                              AS plan,
    (u.banned_until IS NOT NULL AND u.banned_until > now())     AS suspended
  FROM auth.users u
  LEFT JOIN public.books b               ON b.user_id = u.id
  LEFT JOIN public.writing_snapshots ws  ON ws.user_id = u.id
  LEFT JOIN public.profiles p            ON p.user_id = u.id
  GROUP BY u.id, u.email, u.created_at, p.plan, u.banned_until
  ORDER BY u.created_at DESC;
END;
$$;
