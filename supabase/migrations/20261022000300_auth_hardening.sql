-- Auth-хардениг:
-- 1. find_auth_user_by_email — поиск пользователя для telegram-auth / vk-auth вместо
--    listUsers (5×200 = вход ломался после 1000 пользователей). Только service_role.
-- 2. Запрет занять синтетический адрес *.local через публичную регистрацию/смену email:
--    tg-<id>@telegram.local и vk-<id>@vk.local допустимы, только если в raw_app_meta_data
--    лежит тот же telegram_id / vk_id. app_metadata пишет только service_role
--    (edge-функции передают его в admin.createUser одной вставкой), публичный signUp
--    его задать не может. Прочие *.local запрещены всегда.
-- 3. get_inactive_users_for_retention — не слать на *.local, неподтверждённые,
--    заблокированные и удалённые адреса.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS on_auth_user_reserved_email ON auth.users;
--   DROP FUNCTION IF EXISTS public.guard_reserved_email();
--   DROP FUNCTION IF EXISTS public.find_auth_user_by_email(text);
--   get_inactive_users_for_retention — вернуть определение из 20261022000000_baseline_drift.sql
--   (= rollback/functions-before.json).

-- ─── 1. Поиск пользователя по email ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.find_auth_user_by_email(p_email text)
RETURNS TABLE (id uuid, email text, app_metadata jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT u.id, u.email::text, COALESCE(u.raw_app_meta_data, '{}'::jsonb)
    FROM auth.users u
   WHERE u.email = lower(p_email)
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_auth_user_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_auth_user_by_email(text) TO service_role;

-- ─── 2. Зарезервированные адреса *.local ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_reserved_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_email text := lower(COALESCE(NEW.email, ''));
  v_app   jsonb := COALESCE(NEW.raw_app_meta_data, '{}'::jsonb);
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.email IS NOT DISTINCT FROM OLD.email THEN
    RETURN NEW;
  END IF;
  IF v_email !~ '\.local$' THEN
    RETURN NEW;
  END IF;
  IF v_app ? 'telegram_id' AND v_email = 'tg-' || (v_app ->> 'telegram_id') || '@telegram.local' THEN
    RETURN NEW;
  END IF;
  IF v_app ? 'vk_id' AND v_email = 'vk-' || (v_app ->> 'vk_id') || '@vk.local' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'reserved_email_domain' USING ERRCODE = 'P0001';
END;
$$;

REVOKE ALL ON FUNCTION public.guard_reserved_email() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_reserved_email ON auth.users;
CREATE TRIGGER on_auth_user_reserved_email
  BEFORE INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_reserved_email();

-- ─── 3. Retention: только реальные подтверждённые адреса ────────────────────
CREATE OR REPLACE FUNCTION public.get_inactive_users_for_retention()
 RETURNS TABLE(user_id uuid, email text, display_name text, book_title text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.user_id,
    u.email,
    COALESCE(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      split_part(u.email, '@', 1)
    ) AS display_name,
    (
      SELECT b.title
      FROM public.books b
      WHERE b.user_id = p.user_id
      ORDER BY b.updated_at DESC
      LIMIT 1
    ) AS book_title
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE
    p.is_test = false
    AND u.email IS NOT NULL
    AND u.email !~* '\.local$'
    AND u.email_confirmed_at IS NOT NULL
    AND u.deleted_at IS NULL
    AND (u.banned_until IS NULL OR u.banned_until < now())
    AND (
      u.last_sign_in_at IS NULL
      OR u.last_sign_in_at < now() - interval '7 days'
    )
    AND (
      p.retention_email_sent_at IS NULL
      OR p.retention_email_sent_at < now() - interval '7 days'
    )
    AND EXISTS (
      SELECT 1 FROM public.books b WHERE b.user_id = p.user_id
    );
$function$;

REVOKE ALL ON FUNCTION public.get_inactive_users_for_retention() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_inactive_users_for_retention() TO service_role;
