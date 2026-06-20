-- Batch reorder timeline events in a single round-trip.
-- SECURITY DEFINER bypasses RLS, so we check ownership manually.
CREATE OR REPLACE FUNCTION reorder_timeline_events(updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_ids uuid[];
  unauthorized_count int;
BEGIN
  IF jsonb_array_length(updates) = 0 THEN
    RETURN;
  END IF;

  SELECT array_agg((item->>'id')::uuid)
  INTO event_ids
  FROM jsonb_array_elements(updates) AS item;

  -- Каждый ID должен принадлежать вызывающему пользователю
  SELECT COUNT(*)
  INTO unauthorized_count
  FROM unnest(event_ids) AS eid
  WHERE NOT EXISTS (
    SELECT 1 FROM timeline_events
    WHERE id = eid AND user_id = auth.uid()
  );

  IF unauthorized_count > 0 THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  -- Один батч-апдейт вместо N запросов
  UPDATE timeline_events AS te
  SET position = (item->>'position')::int
  FROM jsonb_array_elements(updates) AS item
  WHERE te.id = (item->>'id')::uuid;
END;
$$;

REVOKE ALL ON FUNCTION reorder_timeline_events(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION reorder_timeline_events(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION reorder_timeline_events(jsonb) TO authenticated;
