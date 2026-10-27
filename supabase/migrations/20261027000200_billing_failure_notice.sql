-- G-6: письмо пользователю после первой неудачной попытки автосписания за период.
--
-- profiles.billing_failure_notified_for — plan_expires_at, о неудачном продлении которого
-- уже написали. billing-scheduler захватывает отправку атомарно (claim) и снимает захват,
-- если письмо не ушло (release) — как renewal_reminder_sent_for. Новый период → новый
-- plan_expires_at → письмо снова возможно. Сбрасывать при понижении не нужно: маркер
-- сравнивается с текущим plan_expires_at.
--
-- Права: колонку пишет только service_role (UPDATE клиенту — только onboarded_at/display_name,
-- 20260702_profiles_lock_privileged_columns), RLS у profiles уже есть.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.claim_billing_failure_notice(uuid, timestamptz);
--   DROP FUNCTION IF EXISTS public.release_billing_failure_notice(uuid, timestamptz);
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS billing_failure_notified_for;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS billing_failure_notified_for timestamptz;

CREATE OR REPLACE FUNCTION public.claim_billing_failure_notice(p_user_id uuid, p_expiry timestamptz)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.profiles
     SET billing_failure_notified_for = plan_expires_at
   WHERE user_id = p_user_id
     AND plan = 'pro'
     AND plan_expires_at = p_expiry
     AND billing_failure_notified_for IS DISTINCT FROM plan_expires_at;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_billing_failure_notice(p_user_id uuid, p_expiry timestamptz)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  UPDATE public.profiles
     SET billing_failure_notified_for = NULL
   WHERE user_id = p_user_id AND billing_failure_notified_for = p_expiry;
$$;

REVOKE ALL ON FUNCTION public.claim_billing_failure_notice(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_billing_failure_notice(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_billing_failure_notice(uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_billing_failure_notice(uuid, timestamptz) TO service_role;
