-- Security hardening M3 (review 2026-06-29, session 3): RLS book_id ownership
-- Existing INSERT policies only check `user_id = auth.uid()`. A user could pass
-- a foreign book_id and successfully insert a row attached to someone else's book
-- (the row stays invisible to them via SELECT RLS, but pollutes the target book's
-- data and can be picked up by SECURITY DEFINER paths that key off book_id alone,
-- e.g. the public share-by-token flow). Extend WITH CHECK to require that book_id
-- belongs to a book owned by the inserting user.

BEGIN;

-- chapters
DROP POLICY "chapters insert own" ON public.chapters;
CREATE POLICY "chapters insert own" ON public.chapters FOR INSERT WITH CHECK (
  (select auth.uid()) = user_id
  AND book_id IN (SELECT id FROM public.books WHERE user_id = (select auth.uid()))
);

-- characters
DROP POLICY "characters insert own" ON public.characters;
CREATE POLICY "characters insert own" ON public.characters FOR INSERT WITH CHECK (
  (select auth.uid()) = user_id
  AND book_id IN (SELECT id FROM public.books WHERE user_id = (select auth.uid()))
);

-- character_relations
DROP POLICY "character_relations insert own" ON public.character_relations;
CREATE POLICY "character_relations insert own" ON public.character_relations FOR INSERT WITH CHECK (
  (select auth.uid()) = user_id
  AND book_id IN (SELECT id FROM public.books WHERE user_id = (select auth.uid()))
);

-- chapter_characters
DROP POLICY "chapter_characters insert own" ON public.chapter_characters;
CREATE POLICY "chapter_characters insert own" ON public.chapter_characters FOR INSERT WITH CHECK (
  (select auth.uid()) = user_id
  AND book_id IN (SELECT id FROM public.books WHERE user_id = (select auth.uid()))
);

-- timeline_events
DROP POLICY "timeline_events insert own" ON public.timeline_events;
CREATE POLICY "timeline_events insert own" ON public.timeline_events FOR INSERT WITH CHECK (
  (select auth.uid()) = user_id
  AND book_id IN (SELECT id FROM public.books WHERE user_id = (select auth.uid()))
);

-- locations
DROP POLICY "locations insert own" ON public.locations;
CREATE POLICY "locations insert own" ON public.locations FOR INSERT WITH CHECK (
  (select auth.uid()) = user_id
  AND book_id IN (SELECT id FROM public.books WHERE user_id = (select auth.uid()))
);

-- location_connections
DROP POLICY "lconn insert own" ON public.location_connections;
CREATE POLICY "lconn insert own" ON public.location_connections FOR INSERT WITH CHECK (
  (select auth.uid()) = user_id
  AND book_id IN (SELECT id FROM public.books WHERE user_id = (select auth.uid()))
);

-- notes (single ALL policy — only WITH CHECK changes, USING/select+delete behavior untouched)
DROP POLICY "notes: owner access" ON public.notes;
CREATE POLICY "notes: owner access" ON public.notes FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id
    AND book_id IN (SELECT id FROM public.books WHERE user_id = (select auth.uid()))
  );

-- chapter_versions: no book_id column — ownership runs through chapter_id instead
DROP POLICY "chapter_versions insert own" ON public.chapter_versions;
CREATE POLICY "chapter_versions insert own" ON public.chapter_versions FOR INSERT WITH CHECK (
  (select auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.chapters c
    WHERE c.id = chapter_versions.chapter_id AND c.user_id = (select auth.uid())
  )
);

-- map_stamps (single ALL policy — only WITH CHECK changes)
DROP POLICY "owner" ON public.map_stamps;
CREATE POLICY "owner" ON public.map_stamps FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id
    AND book_id IN (SELECT id FROM public.books WHERE user_id = (select auth.uid()))
  );

-- writing_snapshots
DROP POLICY "writing_snapshots insert own" ON public.writing_snapshots;
CREATE POLICY "writing_snapshots insert own" ON public.writing_snapshots FOR INSERT WITH CHECK (
  (select auth.uid()) = user_id
  AND book_id IN (SELECT id FROM public.books WHERE user_id = (select auth.uid()))
);

COMMIT;
