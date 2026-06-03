-- Авторская студия — admin audit log + set_user_plan RPC.
--
-- Создаёт:
--   1. admin_audit_log — история всех действий администратора.
--   2. set_user_plan   — защищённый RPC смены плана с записью в лог.
--   3. get_admin_audit_log — защищённый RPC чтения лога.

-- 1. Таблица лога.
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id       uuid        NOT NULL,
  admin_email    text        NOT NULL,
  action         text        NOT NULL,
  target_user_id uuid,
  payload        jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_audit_log_created_at_idx ON public.admin_audit_log (created_at DESC);
CREATE INDEX admin_audit_log_target_user_idx ON public.admin_audit_log (target_user_id);

-- RLS: писать может только SECURITY DEFINER-функция (authenticated не имеет INSERT).
-- Читать запрещено всем — только через get_admin_audit_log RPC.
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON TABLE public.admin_audit_log TO authenticated;

-- 2. set_user_plan — с проверкой прав, логом и атомарным обновлением.
CREATE OR REPLACE FUNCTION public.set_user_plan(
  target_user_id uuid,
  new_plan       text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_email text;
  v_caller_id   uuid;
  v_old_plan    text;
BEGIN
  SELECT value INTO v_admin_email FROM public.app_config WHERE key = 'admin_email';

  IF (auth.jwt() ->> 'email') IS DISTINCT FROM v_admin_email THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  v_caller_id := auth.uid();

  SELECT plan INTO v_old_plan
  FROM public.profiles
  WHERE profiles.user_id = target_user_id;

  IF v_old_plan IS NULL THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_old_plan = new_plan THEN
    RETURN;
  END IF;

  UPDATE public.profiles
  SET plan = new_plan
  WHERE profiles.user_id = target_user_id;

  INSERT INTO public.admin_audit_log (admin_id, admin_email, action, target_user_id, payload)
  VALUES (
    v_caller_id,
    v_admin_email,
    'set_plan',
    target_user_id,
    jsonb_build_object('old_plan', v_old_plan, 'new_plan', new_plan)
  );
END;
$$;

-- 3. get_admin_audit_log — возвращает последние 200 записей с email цели.
CREATE OR REPLACE FUNCTION public.get_admin_audit_log()
RETURNS TABLE(
  id             uuid,
  action         text,
  target_user_id uuid,
  target_email   text,
  payload        jsonb,
  created_at     timestamptz
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
    l.created_at
  FROM public.admin_audit_log l
  LEFT JOIN auth.users u ON u.id = l.target_user_id
  ORDER BY l.created_at DESC
  LIMIT 200;
END;
$$;
