-- ARCH-3: move regexp search for character mentions to PostgreSQL
-- Replaces N+1 pattern (fetch all chapters + JS regex per chapter)
-- with a single RPC call.
--
-- Word boundaries use explicit Cyrillic+Latin ranges instead of \m/\M
-- because Supabase defaults to C locale where \m/\M only cover ASCII.

CREATE OR REPLACE FUNCTION sync_character_chapters(
  p_character_id uuid,
  p_book_id      uuid,
  p_aliases      text[]
)
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_user_id   uuid;
  v_escaped   text[];
  v_pattern   text;
  v_found_ids uuid[];
  a           text;
BEGIN
  -- Verify character belongs to caller; RLS ensures unauthorized chars return nothing
  SELECT user_id INTO v_user_id
  FROM characters
  WHERE id = p_character_id;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Build lowercased, POSIX-ERE-escaped alias list
  v_escaped := ARRAY[]::text[];
  FOREACH a IN ARRAY p_aliases LOOP
    a := lower(trim(a));
    CONTINUE WHEN a = '';
    -- Escape POSIX ERE metacharacters: . + * ? ^ $ { } ( ) | [ ] \
    a := regexp_replace(a, '([.+*?^${}()|[\]\\])', '\\\1', 'g');
    v_escaped := v_escaped || a;
  END LOOP;

  IF cardinality(v_escaped) = 0 THEN
    RETURN;
  END IF;

  -- Word-boundary pattern using explicit Cyrillic+Latin ranges
  v_pattern := '(^|[^а-яёa-z0-9_])(' ||
               array_to_string(v_escaped, '|') ||
               ')([^а-яёa-z0-9_]|$)';

  -- Strip HTML tags and &entities;, lowercase, then match
  SELECT array_agg(id) INTO v_found_ids
  FROM chapters
  WHERE book_id = p_book_id
    AND lower(
          regexp_replace(
            regexp_replace(content, '<[^>]*>', ' ', 'g'),
            '&[a-z0-9#]+;', ' ', 'g'
          )
        ) ~ v_pattern;

  v_found_ids := coalesce(v_found_ids, ARRAY[]::uuid[]);

  -- Upsert matched chapters; DO NOTHING preserves manual (auto_detected=false) links
  IF cardinality(v_found_ids) > 0 THEN
    INSERT INTO chapter_characters (book_id, user_id, chapter_id, character_id, auto_detected)
    SELECT p_book_id, v_user_id, unnest(v_found_ids), p_character_id, true
    ON CONFLICT (chapter_id, character_id) DO NOTHING;
  END IF;

  -- Remove auto-detected rows for chapters that no longer contain the character
  DELETE FROM chapter_characters
  WHERE character_id = p_character_id
    AND auto_detected = true
    AND is_pov        = false
    AND chapter_id IN (
      SELECT id FROM chapters
      WHERE book_id = p_book_id
        AND NOT (id = ANY(v_found_ids))
    );
END;
$fn$;

GRANT EXECUTE ON FUNCTION sync_character_chapters(uuid, uuid, text[]) TO authenticated;
