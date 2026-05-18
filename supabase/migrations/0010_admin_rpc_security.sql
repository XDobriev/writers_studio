-- Авторская студия — серверная защита admin RPC-функций.
--
-- Проблема: get_admin_stats и get_admin_users выполняются с SECURITY DEFINER
-- но не проверяют кто вызывает. Любой залогиненный пользователь мог вызвать
-- их напрямую через REST API и получить email/данные всех пользователей.
--
-- Решение:
--   1. Таблица app_config — хранит admin_email без захардкоживания в коде.
--      RLS закрывает её от authenticated/anon. SECURITY DEFINER-функции читают мимо RLS.
--   2. Обе функции конвертированы sql → plpgsql для поддержки IF/RAISE.
--   3. Проверка auth.jwt() ->> 'email' происходит на сервере, до любых данных.

-- 1. Таблица конфигурации приложения (пока один ключ, масштабируется).
CREATE TABLE IF NOT EXISTS public.app_config (
  key   text PRIMARY KEY,
  value text NOT NULL
);

-- Никакого доступа для authenticated/anon — только service_role и SECURITY DEFINER функции.
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- 2. Записываем admin email. При смене email — просто UPDATE, миграции не нужны.
INSERT INTO public.app_config (key, value)
VALUES ('admin_email', 'frfrancuz@gmail.com')
ON CONFLICT (key) DO NOTHING;

-- 3. Защищённая версия get_admin_stats.
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS json
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

  RETURN (
    SELECT json_build_object(
      'users_total',    (SELECT COUNT(*) FROM auth.users),
      'users_7d',       (SELECT COUNT(*) FROM auth.users WHERE created_at >= NOW() - INTERVAL '7 days'),
      'users_30d',      (SELECT COUNT(*) FROM auth.users WHERE created_at >= NOW() - INTERVAL '30 days'),
      'books_total',    (SELECT COUNT(*) FROM public.books),
      'chapters_total', (SELECT COUNT(*) FROM public.chapters),
      'words_total',    (SELECT COALESCE(SUM(words), 0) FROM public.books),
      'dau',            (SELECT COUNT(DISTINCT user_id) FROM public.writing_snapshots WHERE date = CURRENT_DATE),
      'wau',            (SELECT COUNT(DISTINCT user_id) FROM public.writing_snapshots WHERE date >= CURRENT_DATE - INTERVAL '7 days'),
      'mau',            (SELECT COUNT(DISTINCT user_id) FROM public.writing_snapshots WHERE date >= CURRENT_DATE - INTERVAL '30 days'),
      'snapshots_30d',  (SELECT COUNT(*) FROM public.writing_snapshots WHERE date >= CURRENT_DATE - INTERVAL '30 days')
    )
  );
END;
$$;

-- 4. Защищённая версия get_admin_users.
CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS TABLE(
  id          uuid,
  email       text,
  created_at  timestamptz,
  books_count bigint,
  words_total bigint,
  last_active date
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
    COUNT(DISTINCT b.id)::bigint         AS books_count,
    COALESCE(SUM(b.words), 0)::bigint    AS words_total,
    MAX(ws.date)                         AS last_active
  FROM auth.users u
  LEFT JOIN public.books b        ON b.user_id = u.id
  LEFT JOIN public.writing_snapshots ws ON ws.user_id = u.id
  GROUP BY u.id, u.email, u.created_at
  ORDER BY u.created_at DESC;
END;
$$;
