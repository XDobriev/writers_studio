-- Baseline дрейфа: объекты, которые есть в проде, но не создаются ни одной миграцией репо.
--
-- Источник — снимок прода 2026-10-22 (.qa/research/2026-10-22/rollback/*.json:
-- functions-before, columns-before, constraints-before, policies-before, triggers-before,
-- buckets-before). Определения перенесены как есть, без исправлений: правки идут
-- отдельными миграциями ниже по порядку.
--
-- Идемпотентна: на проде — no-op (IF NOT EXISTS / CREATE OR REPLACE с той же
-- сигнатурой и телом / DO-блоки с проверкой pg_policies и pg_trigger).
--
-- ВАЖНО для чистой БД (branch, перенос на VPS): по имени этот файл идёт ПОСЛЕ старых
-- миграций, а 0011+ уже обращаются к profiles. Для воспроизведения схемы с нуля
-- этот файл нужно применить первым (или переименовать в 0000_baseline.sql).
--
-- ROLLBACK: не требуется — файл ничего не меняет на проде. На чистой БД откат =
--   drop trigger on_auth_user_profile_created on auth.users; drop trigger trg_chapters_synopsis on public.chapters;
--   drop function public.handle_new_user_profile(), public.trg_chapters_synopsis_fn(),
--     public.compute_synopsis(text), public.strip_html(text), public.get_inactive_users_for_retention(),
--     public.remove_user_dictionary_word(uuid, text), public.get_public_stats();
--   drop table public.profiles;  (+ колонки ниже через ALTER TABLE ... DROP COLUMN)

-- ─── profiles ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id                 uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan                    text NOT NULL DEFAULT 'free'
                          CONSTRAINT profiles_plan_check CHECK (plan = ANY (ARRAY['free'::text, 'pro'::text, 'lifetime'::text])),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  plan_expires_at         timestamptz,
  onboarded_at            timestamptz,
  user_dictionary         text[] DEFAULT '{}'::text[],
  grandfathered           boolean NOT NULL DEFAULT false,
  is_test                 boolean NOT NULL DEFAULT false,
  recurring_inv_id        text,
  cancel_at_period_end    boolean NOT NULL DEFAULT false,
  plan_interval           text NOT NULL DEFAULT 'monthly'
                          CONSTRAINT profiles_plan_interval_check CHECK (plan_interval = ANY (ARRAY['monthly'::text, 'annual'::text])),
  retention_email_sent_at timestamptz,
  display_name            text,
  last_billed_expiry      timestamptz,
  checklist_dismissed_at  timestamptz,
  first_export_at         timestamptz
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_expires_at         timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarded_at            timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_dictionary         text[] DEFAULT '{}'::text[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS grandfathered           boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_test                 boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS recurring_inv_id        text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cancel_at_period_end    boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_interval           text NOT NULL DEFAULT 'monthly';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS retention_email_sent_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name            text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_billed_expiry      timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS checklist_dismissed_at  timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_export_at         timestamptz;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can view own profile') THEN
    CREATE POLICY "Users can view own profile" ON public.profiles
      FOR SELECT USING ((SELECT auth.uid()) = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles insert own') THEN
    CREATE POLICY "profiles insert own" ON public.profiles
      FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles update own') THEN
    CREATE POLICY "profiles update own" ON public.profiles
      FOR UPDATE USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;
END $$;

-- Профиль заводит триггер на auth.users (клиентский INSERT отозван в 20260702).
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (user_id, plan)
  values (new.id, 'free')
  on conflict (user_id) do nothing;
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION public.handle_new_user_profile() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'auth' AND c.relname = 'users' AND t.tgname = 'on_auth_user_profile_created'
  ) THEN
    CREATE TRIGGER on_auth_user_profile_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();
  END IF;
END $$;

-- ─── chapters.synopsis и его триггер ─────────────────────────────────────────
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS synopsis text NOT NULL DEFAULT ''::text;

CREATE OR REPLACE FUNCTION public.strip_html(html text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  RETURN regexp_replace(
    regexp_replace(
      regexp_replace(html, '<style[\s\S]*?<\/style>', ' ', 'g'),
      '<script[\s\S]*?<\/script>', ' ', 'g'
    ),
    '<[^>]+>', ' ', 'g'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.compute_synopsis(html text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  plain TEXT;
BEGIN
  IF html IS NULL OR html = '' THEN RETURN ''; END IF;
  plain := trim(regexp_replace(strip_html(html), '\s+', ' ', 'g'));
  IF length(plain) <= 240 THEN RETURN plain; END IF;
  RETURN left(plain, 240) || '…';
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_chapters_synopsis_fn()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.synopsis IS NULL OR NEW.synopsis = '' THEN
      NEW.synopsis := compute_synopsis(NEW.content);
    END IF;
  ELSE
    -- UPDATE: не перезаписывать если пользователь вручную изменил синопсис
    IF NEW.synopsis IS NULL OR NEW.synopsis = '' OR NEW.synopsis = compute_synopsis(OLD.content) THEN
      NEW.synopsis := compute_synopsis(NEW.content);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'chapters' AND t.tgname = 'trg_chapters_synopsis'
  ) THEN
    CREATE TRIGGER trg_chapters_synopsis
      BEFORE INSERT OR UPDATE OF content ON public.chapters
      FOR EACH ROW EXECUTE FUNCTION public.trg_chapters_synopsis_fn();
  END IF;
END $$;

-- ─── Колонки, которые используются кодом, но не добавляются миграциями ──────
ALTER TABLE public.chapter_characters ADD COLUMN IF NOT EXISTS auto_detected boolean NOT NULL DEFAULT false;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS position     integer NOT NULL DEFAULT 0;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS custom_color text;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS custom_label text;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS size numeric NOT NULL DEFAULT 1.0;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS genres     text[] DEFAULT '{}'::text[];
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS daily_goal integer NOT NULL DEFAULT 1000;

-- ─── RPC, которых нет в миграциях ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.remove_user_dictionary_word(p_user_id uuid, p_word text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET user_dictionary = array_remove(user_dictionary, p_word)
  WHERE user_id = p_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.remove_user_dictionary_word(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_user_dictionary_word(uuid, text) TO authenticated;

-- Публичные счётчики (в проде EXECUTE есть у anon — сохраняем как есть).
CREATE OR REPLACE FUNCTION public.get_public_stats()
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'users_total',  (SELECT COUNT(*) FROM auth.users),
    'books_total',  (SELECT COUNT(*) FROM public.books),
    'words_total',  (SELECT COALESCE(SUM(words), 0) FROM public.books)
  );
$function$;

-- Прод-версия; фильтры .local/подтверждения добавляет 20261022000300_auth_hardening.
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

-- ─── Storage: бакеты book-covers / map-backgrounds и их политики ────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('book-covers', 'book-covers', true), ('map-backgrounds', 'map-backgrounds', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users upload own covers') THEN
    CREATE POLICY "Users upload own covers" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'book-covers' AND (storage.foldername(name))[1] = (auth.uid())::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users update own covers') THEN
    CREATE POLICY "Users update own covers" ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'book-covers' AND (storage.foldername(name))[1] = (auth.uid())::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users delete own covers') THEN
    CREATE POLICY "Users delete own covers" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'book-covers' AND (storage.foldername(name))[1] = (auth.uid())::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users read own covers') THEN
    CREATE POLICY "Users read own covers" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'book-covers' AND (storage.foldername(name))[1] = (auth.uid())::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users upload own map bg') THEN
    CREATE POLICY "Users upload own map bg" ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'map-backgrounds' AND (auth.uid())::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users update own map bg') THEN
    CREATE POLICY "Users update own map bg" ON storage.objects FOR UPDATE
      USING (bucket_id = 'map-backgrounds' AND (auth.uid())::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users read own map bg') THEN
    CREATE POLICY "Users read own map bg" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'map-backgrounds' AND (auth.uid())::text = (storage.foldername(name))[1]);
  END IF;
END $$;
