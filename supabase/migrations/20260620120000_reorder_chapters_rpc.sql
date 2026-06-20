-- Batch reorder chapters in a single round-trip.
-- SECURITY DEFINER bypasses RLS, so we check ownership manually.
CREATE OR REPLACE FUNCTION reorder_chapters(updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chapter_ids uuid[];
  unauthorized_count int;
BEGIN
  IF jsonb_array_length(updates) = 0 THEN
    RETURN;
  END IF;

  SELECT array_agg((item->>'id')::uuid)
  INTO chapter_ids
  FROM jsonb_array_elements(updates) AS item;

  -- Каждый ID должен принадлежать вызывающему пользователю
  SELECT COUNT(*)
  INTO unauthorized_count
  FROM unnest(chapter_ids) AS cid
  WHERE NOT EXISTS (
    SELECT 1 FROM chapters
    WHERE id = cid AND user_id = auth.uid()
  );

  IF unauthorized_count > 0 THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  -- Один батч-апдейт вместо N запросов
  UPDATE chapters AS c
  SET position = (item->>'position')::int
  FROM jsonb_array_elements(updates) AS item
  WHERE c.id = (item->>'id')::uuid;
END;
$$;

REVOKE ALL ON FUNCTION reorder_chapters(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reorder_chapters(jsonb) TO authenticated;
