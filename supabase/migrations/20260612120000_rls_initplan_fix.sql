-- Fix RLS "initplan" performance issue: replace auth.uid() with (select auth.uid())
-- so PostgreSQL evaluates the function once per query instead of once per row.

BEGIN;

-- books
DROP POLICY "books delete own" ON public.books;
CREATE POLICY "books delete own" ON public.books FOR DELETE USING ((select auth.uid()) = user_id);

DROP POLICY "books insert own" ON public.books;
CREATE POLICY "books insert own" ON public.books FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY "books select own" ON public.books;
CREATE POLICY "books select own" ON public.books FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY "books update own" ON public.books;
CREATE POLICY "books update own" ON public.books FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- chapter_characters
DROP POLICY "chapter_characters delete own" ON public.chapter_characters;
CREATE POLICY "chapter_characters delete own" ON public.chapter_characters FOR DELETE USING ((select auth.uid()) = user_id);

DROP POLICY "chapter_characters insert own" ON public.chapter_characters;
CREATE POLICY "chapter_characters insert own" ON public.chapter_characters FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY "chapter_characters select own" ON public.chapter_characters;
CREATE POLICY "chapter_characters select own" ON public.chapter_characters FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY "chapter_characters update own" ON public.chapter_characters;
CREATE POLICY "chapter_characters update own" ON public.chapter_characters FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- chapter_versions
DROP POLICY "chapter_versions delete own" ON public.chapter_versions;
CREATE POLICY "chapter_versions delete own" ON public.chapter_versions FOR DELETE USING ((select auth.uid()) = user_id);

DROP POLICY "chapter_versions insert own" ON public.chapter_versions;
CREATE POLICY "chapter_versions insert own" ON public.chapter_versions FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY "chapter_versions select own" ON public.chapter_versions;
CREATE POLICY "chapter_versions select own" ON public.chapter_versions FOR SELECT USING ((select auth.uid()) = user_id);

-- chapters
DROP POLICY "chapters delete own" ON public.chapters;
CREATE POLICY "chapters delete own" ON public.chapters FOR DELETE USING ((select auth.uid()) = user_id);

DROP POLICY "chapters insert own" ON public.chapters;
CREATE POLICY "chapters insert own" ON public.chapters FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY "chapters select own" ON public.chapters;
CREATE POLICY "chapters select own" ON public.chapters FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY "chapters update own" ON public.chapters;
CREATE POLICY "chapters update own" ON public.chapters FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- character_relations
DROP POLICY "character_relations delete own" ON public.character_relations;
CREATE POLICY "character_relations delete own" ON public.character_relations FOR DELETE USING ((select auth.uid()) = user_id);

DROP POLICY "character_relations insert own" ON public.character_relations;
CREATE POLICY "character_relations insert own" ON public.character_relations FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY "character_relations select own" ON public.character_relations;
CREATE POLICY "character_relations select own" ON public.character_relations FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY "character_relations update own" ON public.character_relations;
CREATE POLICY "character_relations update own" ON public.character_relations FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- character_relationships
DROP POLICY "character_relationships delete own" ON public.character_relationships;
CREATE POLICY "character_relationships delete own" ON public.character_relationships FOR DELETE USING ((select auth.uid()) = user_id);

DROP POLICY "character_relationships insert own" ON public.character_relationships;
CREATE POLICY "character_relationships insert own" ON public.character_relationships FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY "character_relationships select own" ON public.character_relationships;
CREATE POLICY "character_relationships select own" ON public.character_relationships FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY "character_relationships update own" ON public.character_relationships;
CREATE POLICY "character_relationships update own" ON public.character_relationships FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- characters
DROP POLICY "characters delete own" ON public.characters;
CREATE POLICY "characters delete own" ON public.characters FOR DELETE USING ((select auth.uid()) = user_id);

DROP POLICY "characters insert own" ON public.characters;
CREATE POLICY "characters insert own" ON public.characters FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY "characters select own" ON public.characters;
CREATE POLICY "characters select own" ON public.characters FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY "characters update own" ON public.characters;
CREATE POLICY "characters update own" ON public.characters FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- location_connections
DROP POLICY "lconn delete own" ON public.location_connections;
CREATE POLICY "lconn delete own" ON public.location_connections FOR DELETE USING ((select auth.uid()) = user_id);

DROP POLICY "lconn insert own" ON public.location_connections;
CREATE POLICY "lconn insert own" ON public.location_connections FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY "lconn select own" ON public.location_connections;
CREATE POLICY "lconn select own" ON public.location_connections FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY "lconn update own" ON public.location_connections;
CREATE POLICY "lconn update own" ON public.location_connections FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- locations
DROP POLICY "locations delete own" ON public.locations;
CREATE POLICY "locations delete own" ON public.locations FOR DELETE USING ((select auth.uid()) = user_id);

DROP POLICY "locations insert own" ON public.locations;
CREATE POLICY "locations insert own" ON public.locations FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY "locations select own" ON public.locations;
CREATE POLICY "locations select own" ON public.locations FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY "locations update own" ON public.locations;
CREATE POLICY "locations update own" ON public.locations FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- notes
DROP POLICY "notes: owner access" ON public.notes;
CREATE POLICY "notes: owner access" ON public.notes FOR ALL USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- profiles
DROP POLICY "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY "profiles insert own" ON public.profiles;
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY "profiles update own" ON public.profiles;
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- timeline_events
DROP POLICY "timeline_events delete own" ON public.timeline_events;
CREATE POLICY "timeline_events delete own" ON public.timeline_events FOR DELETE USING ((select auth.uid()) = user_id);

DROP POLICY "timeline_events insert own" ON public.timeline_events;
CREATE POLICY "timeline_events insert own" ON public.timeline_events FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY "timeline_events select own" ON public.timeline_events;
CREATE POLICY "timeline_events select own" ON public.timeline_events FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY "timeline_events update own" ON public.timeline_events;
CREATE POLICY "timeline_events update own" ON public.timeline_events FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- writing_snapshots
DROP POLICY "writing_snapshots delete own" ON public.writing_snapshots;
CREATE POLICY "writing_snapshots delete own" ON public.writing_snapshots FOR DELETE USING ((select auth.uid()) = user_id);

DROP POLICY "writing_snapshots insert own" ON public.writing_snapshots;
CREATE POLICY "writing_snapshots insert own" ON public.writing_snapshots FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY "writing_snapshots select own" ON public.writing_snapshots;
CREATE POLICY "writing_snapshots select own" ON public.writing_snapshots FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY "writing_snapshots update own" ON public.writing_snapshots;
CREATE POLICY "writing_snapshots update own" ON public.writing_snapshots FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

COMMIT;
