-- Ежедневный запуск billing-scheduler и retention-email через pg_cron + pg_net
-- (вместо GitHub Actions cron: репозиторий публичный — scheduled-workflow отключается
-- после 60 дней без коммитов, а лог с ответом функции виден всем).
--
-- Секреты Bearer берутся из Vault по образцу notify_new_user (vault.decrypted_secrets):
--   scheduler_secret = значение Edge Secret SCHEDULER_SECRET  (billing-scheduler)
--   cron_secret      = значение Edge Secret CRON_SECRET       (retention-email)
-- Создать ДО применения (иначе вызов молча пропускается с warning):
--   select vault.create_secret('<SCHEDULER_SECRET>', 'scheduler_secret', 'Bearer для billing-scheduler');
--   select vault.create_secret('<CRON_SECRET>', 'cron_secret', 'Bearer для retention-email');
-- При ротации обновлять ОБА места (Edge Secret и Vault).
--
-- Расписание (UTC): billing-scheduler 06:00 (09:00 МСК), retention-email 07:00 (10:00 МСК).
-- Без pg_cron/pg_net (локальная проверка, PGlite) блок cron пропускается.
--
-- ROLLBACK:
--   select cron.unschedule('billing-scheduler-daily');
--   select cron.unschedule('retention-email-daily');
--   DROP FUNCTION IF EXISTS public.invoke_edge_function(text, text);
--   (GitHub workflow billing-scheduler.yml вернуть schedule: '5 6 * * *')

CREATE OR REPLACE FUNCTION public.invoke_edge_function(p_function text, p_secret_name text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_secret text;
  v_request_id bigint;
BEGIN
  IF p_function NOT IN ('billing-scheduler', 'retention-email') THEN
    RAISE EXCEPTION 'function not allowed: %', p_function USING ERRCODE = '42501';
  END IF;

  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
   WHERE name = p_secret_name
   LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE WARNING 'invoke_edge_function: vault secret % is missing, % skipped', p_secret_name, p_function;
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := 'https://joaxeoavjvlqmtlepkrr.supabase.co/functions/v1/' || p_function,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_edge_function(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_edge_function(text, text) TO service_role;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM cron.schedule(
      'billing-scheduler-daily',
      '0 6 * * *',
      $job$select public.invoke_edge_function('billing-scheduler', 'scheduler_secret')$job$
    );
    PERFORM cron.schedule(
      'retention-email-daily',
      '0 7 * * *',
      $job$select public.invoke_edge_function('retention-email', 'cron_secret')$job$
    );
  ELSE
    RAISE NOTICE 'pg_cron/pg_net not installed — cron jobs not scheduled';
  END IF;
END
$cron$;
