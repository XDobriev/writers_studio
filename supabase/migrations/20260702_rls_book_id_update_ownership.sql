-- Security hardening M3b (review 2026-06-29, follow-up to M3): RLS book_id ownership on UPDATE
-- M3 (20260630) closed the INSERT bypass but left UPDATE untouched: the UPDATE
-- policies below only check `user_id = auth.uid()` in WITH CHECK, so a user could
-- UPDATE their own row and re-point its book_id to someone else's book (USING passes
-- because the old row is theirs; WITH CHECK passes because user_id is unchanged).
-- Extend WITH CHECK to require the new book_id belongs to a book owned by the user.
-- Additionally, `character_relationships` was never covered by M3 at all — its INSERT
-- and UPDATE policies both need the same book_id guard.
-- map_stamps and notes already carry the guard via their single ALL policy.
-- chapter_versions has no UPDATE policy (versions are immutable) — nothing to close.

BEGIN;

-- chapters
DROP POLICY "chapters update own" ON public.chapters;
CREATE POLICY "chapters update own" ON public.chapters FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id
    AND book_id IN (SELECT id FROM public.books WHERE user_id = (select auth.uid()))
  );

-- characters
DROP POLICY "characters update own" ON public.characters;
CREATE POLICY "characters update own" ON public.characters FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id
    AND book_id IN (SELECT id FROM public.books WHERE user_id = (select auth.uid()))
  );

-- character_relations
DROP POLICY "character_relations update own" ON public.character_relations;
CREATE POLICY "character_relations update own" ON public.character_relations FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id
    AND book_id IN (SELECT id FROM public.books WHERE user_id = (select auth.uid()))
  );

-- chapter_characters
DROP POLICY "chapter_characters update own" ON public.chapter_characters;
CREATE POLICY "chapter_characters update own" ON public.chapter_characters FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id
    AND book_id IN (SELECT id FROM public.books WHERE user_id = (select auth.uid()))
  );

-- timeline_events
DROP POLICY "timeline_events update own" ON public.timeline_events;
CREATE POLICY "timeline_events update own" ON public.timeline_events FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id
    AND book_id IN (SELECT id FROM public.books WHERE user_id = (select auth.uid()))
  );

-- locations
DROP POLICY "locations update own" ON public.locations;
CREATE POLICY "locations update own" ON public.locations FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id
    AND book_id IN (SELECT id FROM public.books WHERE user_id = (select auth.uid()))
  );

-- location_connections
DROP POLICY "lconn update own" ON public.location_connections;
CREATE POLICY "lconn update own" ON public.location_connections FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id
    AND book_id IN (SELECT id FROM public.books WHERE user_id = (select auth.uid()))
  );

-- writing_snapshots
DROP POLICY "writing_snapshots update own" ON public.writing_snapshots;
CREATE POLICY "writing_snapshots update own" ON public.writing_snapshots FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id
    AND book_id IN (SELECT id FROM public.books WHERE user_id = (select auth.uid()))
  );

-- character_relationships (never covered by M3): INSERT + UPDATE
DROP POLICY "character_relationships insert own" ON public.character_relationships;
CREATE POLICY "character_relationships insert own" ON public.character_relationships FOR INSERT WITH CHECK (
  (select auth.uid()) = user_id
  AND book_id IN (SELECT id FROM public.books WHERE user_id = (select auth.uid()))
);

DROP POLICY "character_relationships update own" ON public.character_relationships;
CREATE POLICY "character_relationships update own" ON public.character_relationships FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id
    AND book_id IN (SELECT id FROM public.books WHERE user_id = (select auth.uid()))
  );

COMMIT;
