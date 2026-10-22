-- Серверный ретеншн и дедуп снимков глав (вместо клиентского pruneVersions).
--
-- Было: клиент передавал isPro, а план брал из профиля, который мог ещё не загрузиться
-- (или упасть) → Pro считался Free → чистка удаляла все автоснимки, кроме 10.
-- Снимки через keepalive (beforeunload) чистку пропускали вовсе. Для дедупа клиент
-- скачивал полный HTML последнего снимка.
--
-- Стало:
--   * content_hash = md5(content) ставит BEFORE INSERT триггер;
--   * автоснимок (label IS NULL), совпадающий по хэшу с последним снимком главы,
--     не вставляется (триггер возвращает NULL) — дедуп без скачивания контента,
--     работает и для keepalive;
--   * AFTER INSERT триггер чистит автоснимки главы по плану из profiles (is_paid):
--     Pro/Lifetime — старше 30 дней, Free — всё, кроме 10 последних.
--     Именованные версии (label) не трогаются.
--   * GRANT DELETE на chapter_versions authenticated (клиент удаляет версии вручную;
--     раньше работало за счёт дефолтных привилегий).
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS chapter_versions_dedup ON public.chapter_versions;
--   DROP TRIGGER IF EXISTS chapter_versions_prune ON public.chapter_versions;
--   DROP FUNCTION IF EXISTS public.chapter_versions_dedup();
--   DROP FUNCTION IF EXISTS public.prune_chapter_versions();
--   ALTER TABLE public.chapter_versions DROP COLUMN IF EXISTS content_hash;
--   + вернуть клиентский pruneVersions (git revert соответствующего коммита в src/lib/versions.ts).
--   GRANT DELETE оставить — он безвреден (политика "chapter_versions delete own" есть).

ALTER TABLE public.chapter_versions ADD COLUMN IF NOT EXISTS content_hash text;

UPDATE public.chapter_versions SET content_hash = md5(content) WHERE content_hash IS NULL;

CREATE OR REPLACE FUNCTION public.chapter_versions_dedup()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_last text;
BEGIN
  NEW.content_hash := md5(NEW.content);
  IF NEW.label IS NULL THEN
    SELECT v.content_hash INTO v_last
      FROM public.chapter_versions v
     WHERE v.chapter_id = NEW.chapter_id
     ORDER BY v.created_at DESC
     LIMIT 1;
    IF v_last IS NOT DISTINCT FROM NEW.content_hash AND v_last IS NOT NULL THEN
      RETURN NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prune_chapter_versions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.label IS NOT NULL THEN
    RETURN NULL;
  END IF;
  IF public.is_paid(NEW.user_id) THEN
    DELETE FROM public.chapter_versions
     WHERE chapter_id = NEW.chapter_id
       AND label IS NULL
       AND created_at < now() - interval '30 days';
  ELSE
    DELETE FROM public.chapter_versions
     WHERE id IN (
       SELECT id FROM public.chapter_versions
        WHERE chapter_id = NEW.chapter_id AND label IS NULL
        ORDER BY created_at DESC
        OFFSET 10
     );
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.chapter_versions_dedup() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prune_chapter_versions() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS chapter_versions_dedup ON public.chapter_versions;
CREATE TRIGGER chapter_versions_dedup
  BEFORE INSERT ON public.chapter_versions
  FOR EACH ROW EXECUTE FUNCTION public.chapter_versions_dedup();

DROP TRIGGER IF EXISTS chapter_versions_prune ON public.chapter_versions;
CREATE TRIGGER chapter_versions_prune
  AFTER INSERT ON public.chapter_versions
  FOR EACH ROW EXECUTE FUNCTION public.prune_chapter_versions();

GRANT DELETE ON TABLE public.chapter_versions TO authenticated;
