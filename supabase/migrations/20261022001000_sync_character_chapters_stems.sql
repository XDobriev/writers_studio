-- Серверный пересчёт упоминаний персонажа (вызывается при переименовании)
-- по тем же правилам, что клиентский makeAliasPattern (src/lib/characterMatching.ts):
--   * ё и е не различаются — нормализуются и псевдоним, и текст главы;
--   * псевдоним от 5 символов совпадает по основе (len-2) + до 4 букв окончания,
--     иначе «Наташи»/«Наташей» не находились, и RPC удалял такие упоминания.
-- Поведение upsert/delete прежнее: ручные связи (auto_detected=false) и POV не трогаются.
--
-- ROLLBACK: определение функции до изменения — .qa/research/2026-10-22/rollback/functions-before.json
--   (proname = sync_character_chapters); GRANT EXECUTE ... TO anon вернуть не нужно.

CREATE OR REPLACE FUNCTION public.sync_character_chapters(p_character_id uuid, p_book_id uuid, p_aliases text[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_user_id   uuid;
  v_parts     text[];
  v_pattern   text;
  v_found_ids uuid[];
  a           text;
  v_stem      text;
BEGIN
  -- Персонаж принадлежит вызывающему (RLS: чужой вернёт NULL)
  SELECT user_id INTO v_user_id
  FROM characters
  WHERE id = p_character_id;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  v_parts := ARRAY[]::text[];
  FOREACH a IN ARRAY p_aliases LOOP
    a := translate(lower(trim(a)), 'ё', 'е');
    CONTINUE WHEN char_length(a) < 2;
    IF char_length(a) >= 5 THEN
      v_stem := left(a, char_length(a) - 2);
      v_stem := regexp_replace(v_stem, '([.+*?^${}()|[\]\\])', '\\\1', 'g');
      v_parts := v_parts || (v_stem || '[а-яa-z]{0,4}');
    ELSE
      v_parts := v_parts || regexp_replace(a, '([.+*?^${}()|[\]\\])', '\\\1', 'g');
    END IF;
  END LOOP;

  IF cardinality(v_parts) = 0 THEN
    RETURN;
  END IF;

  -- Явные диапазоны кириллицы+латиницы вместо \m/\M (надёжно для любой локали)
  v_pattern := '(^|[^а-яa-z0-9_])(' ||
               array_to_string(v_parts, '|') ||
               ')([^а-яa-z0-9_]|$)';

  SELECT array_agg(id) INTO v_found_ids
  FROM chapters
  WHERE book_id = p_book_id
    AND translate(lower(
          regexp_replace(
            regexp_replace(content, '<[^>]*>', ' ', 'g'),
            '&[a-z0-9#]+;', ' ', 'g'
          )
        ), 'ё', 'е') ~ v_pattern;

  v_found_ids := coalesce(v_found_ids, ARRAY[]::uuid[]);

  IF cardinality(v_found_ids) > 0 THEN
    INSERT INTO chapter_characters (book_id, user_id, chapter_id, character_id, auto_detected)
    SELECT p_book_id, v_user_id, unnest(v_found_ids), p_character_id, true
    ON CONFLICT (chapter_id, character_id) DO NOTHING;
  END IF;

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
$function$;

REVOKE ALL ON FUNCTION public.sync_character_chapters(uuid, uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_character_chapters(uuid, uuid, text[]) TO authenticated;
