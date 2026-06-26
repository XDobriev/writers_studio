-- get_admin_audit_log: добавляем is_test (флаг тест-пользователя из profiles по target_user_id).
-- Фронт (Admin.tsx) скрывает записи тест-пользователей из вкладок «Платежи» и «Журнал».
-- Метрики выручки уже исключают is_test (0041) — это чисто косметика админ-журнала.

DROP FUNCTION IF EXISTS public.get_admin_audit_log();

CREATE FUNCTION public.get_admin_audit_log()
RETURNS TABLE(
  id             uuid,
  action         text,
  target_user_id uuid,
  target_email   text,
  payload        jsonb,
  created_at     timestamptz,
  is_test        boolean
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
$$;
