-- get_admin_user_detail: добавляем email, created_at, plan, suspended напрямую из auth.users
-- Ранее email брался из payload audit-лога (только если был suspend/unsuspend).
CREATE OR REPLACE FUNCTION public.get_admin_user_detail(
  target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_email  text;
  v_user_email   text;
  v_created_at   timestamptz;
  v_plan         text;
  v_suspended    boolean;
  v_result       jsonb;
BEGIN
  SELECT value INTO v_admin_email FROM public.app_config WHERE key = 'admin_email';
  IF (auth.jwt() ->> 'email') IS DISTINCT FROM v_admin_email THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT u.email, u.created_at,
         (u.banned_until IS NOT NULL AND u.banned_until > now())
  INTO v_user_email, v_created_at, v_suspended
  FROM auth.users u WHERE u.id = target_user_id;

  SELECT COALESCE(p.plan, 'free') INTO v_plan
  FROM public.profiles p WHERE p.user_id = target_user_id;

  SELECT jsonb_build_object(
    'email',      v_user_email,
    'created_at', v_created_at,
    'plan',       v_plan,
    'suspended',  v_suspended,
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
