-- Аудит безопасности и производительности.
--
-- Изменения:
--   1. writing_snapshots — добавлены INSERT/UPDATE/DELETE политики.
--   2. profiles — добавлена INSERT политика; UPDATE переделан с WITH CHECK.
--   3. chapter_characters — добавлена UPDATE политика.
--   4. notes — добавлены индексы на user_id и book_id.
--   5. timeline_events — добавлен индекс на chapter_id.
--   6. Удалены дублирующие одноколоночные book_id индексы (покрывались составными).

-- 1. writing_snapshots
CREATE POLICY "writing_snapshots insert own"
  ON writing_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "writing_snapshots update own"
  ON writing_snapshots FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "writing_snapshots delete own"
  ON writing_snapshots FOR DELETE
  USING (auth.uid() = user_id);

-- 2. profiles
CREATE POLICY "profiles insert own"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY "Users can update own profile" ON profiles;
CREATE POLICY "profiles update own"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. chapter_characters
CREATE POLICY "chapter_characters update own"
  ON chapter_characters FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. notes
CREATE INDEX notes_user_id_idx ON notes (user_id);
CREATE INDEX notes_book_id_idx ON notes (book_id);

-- 5. timeline_events
CREATE INDEX timeline_events_chapter_id_idx ON timeline_events (chapter_id);

-- 6. Удаление дублей (покрываются составными (book_id, position))
DROP INDEX IF EXISTS chapters_book_id_idx;
DROP INDEX IF EXISTS characters_book_id_idx;
DROP INDEX IF EXISTS locations_book_id_idx;
DROP INDEX IF EXISTS timeline_events_book_id_idx;
