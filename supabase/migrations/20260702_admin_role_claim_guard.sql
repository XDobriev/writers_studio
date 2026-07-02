-- L11: идентификация админа переносится с auth.jwt()->>'email' на app_metadata.role='admin'.
-- app_metadata пишет только service_role (публичный updateUser не может), поэтому claim нельзя
-- подделать, в отличие от email. is_admin() — единая точка проверки; все SECURITY DEFINER
-- admin-RPC переключаются на неё регенерацией из собственных определений (regexp-swap условия
-- email-guard). Ставший мёртвым `SELECT ... admin_email INTO v_admin_email` намеренно оставлен
-- в телах функций — он инертен (значение не участвует в решении), удаление потребовало бы
-- по-функционного редактирования и повысило бы риск. app_config.admin_email больше не влияет
-- на доступ, но строка сохранена (используется UI и как исторический якорь).
--
-- ⚠️ РУЧНОЙ ШАГ (не в миграции, т.к. зависит от окружения и наличия аккаунта):
--   1. Проставить claim админу:
--        UPDATE auth.users
--        SET raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb)
--                                || jsonb_build_object('role','admin')
--        WHERE email = (SELECT value FROM public.app_config WHERE key = 'admin_email');
--   2. Админ должен ОДИН РАЗ перелогиниться — claim попадает в JWT только при выдаче нового
--      токена. До релогина текущая сессия отдаёт 'Access denied' (JWT без role).

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $ib$
  SELECT coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$ib$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;

DO $do$
DECLARE
  r record;
  new_def text;
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname <> 'is_admin'
      AND p.prosrc ILIKE '%v_admin_email%'
  LOOP
    new_def := pg_get_functiondef(r.oid);
    new_def := regexp_replace(
      new_def,
      '(?:LOWER\s*\(|\()\s*auth\.jwt\(\)\s*->>\s*''email''\s*\)\s+IS\s+DISTINCT\s+FROM\s+v_admin_email',
      'NOT public.is_admin()',
      'g'
    );
    EXECUTE new_def;
  END LOOP;
END
$do$;
