-- reorder_notes(updates jsonb) — перестановка заметок одним запросом.
-- Частичный upsert {id, position} падал: INSERT ... ON CONFLICT проверяет NOT NULL
-- (book_id/user_id) и WITH CHECK insert-политики до разрешения конфликта.
-- Образец — reorder_timeline_events (0044): проверка владельца, один батч-UPDATE.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.reorder_notes(jsonb);
--   (+ git revert клиента src/lib/notes.ts reorderNotes)

CREATE OR REPLACE FUNCTION public.reorder_notes(updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  note_ids uuid[];
  unauthorized_count int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;
  IF updates IS NULL OR jsonb_typeof(updates) <> 'array' OR jsonb_array_length(updates) = 0 THEN
    RETURN;
  END IF;

  SELECT array_agg((item->>'id')::uuid)
    INTO note_ids
    FROM jsonb_array_elements(updates) AS item;

  SELECT count(*)
    INTO unauthorized_count
    FROM unnest(note_ids) AS nid
   WHERE NOT EXISTS (SELECT 1 FROM public.notes WHERE id = nid AND user_id = v_uid);

  IF unauthorized_count > 0 THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.notes AS n
     SET position = (item->>'position')::int
    FROM jsonb_array_elements(updates) AS item
   WHERE n.id = (item->>'id')::uuid
     AND n.user_id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_notes(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_notes(jsonb) TO authenticated;
