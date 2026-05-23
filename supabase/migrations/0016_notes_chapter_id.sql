ALTER TABLE notes
  ADD COLUMN chapter_id uuid REFERENCES chapters(id) ON DELETE SET NULL;

CREATE INDEX idx_notes_chapter_id
  ON notes(chapter_id)
  WHERE chapter_id IS NOT NULL;
