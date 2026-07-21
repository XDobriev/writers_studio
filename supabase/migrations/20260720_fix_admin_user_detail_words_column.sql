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
        'words_total',    COALESCE((SELECT sum(c.words) FROM public.chapters c WHERE c.book_id = b.id), 0)
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
