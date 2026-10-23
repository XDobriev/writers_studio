-- Перенос в серию (duplicate_book_content) копирует строки персонажей вместе со ссылкой
-- на файл аватара оригинала. Клиент копирует файлы в Storage и одним вызовом перешивает
-- ссылки копий. Почему RPC, а не upsert с клиента: upsert запускает BEFORE INSERT-триггер
-- лимита Free (characters_free_plan_limit) даже при ON CONFLICT, а цикл update — N запросов.
--
-- SECURITY INVOKER: работает RLS characters — можно изменить только свои строки.
-- Возвращает число обновлённых строк.
CREATE OR REPLACE FUNCTION public.remap_character_avatars(p_book uuid, p_map jsonb)
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  WITH m AS (
    SELECT key::uuid AS id, value AS url FROM jsonb_each_text(p_map)
  ), u AS (
    UPDATE public.characters c
       SET avatar_url = m.url
      FROM m
     WHERE c.id = m.id AND c.book_id = p_book
    RETURNING 1
  )
  SELECT count(*)::integer FROM u;
$$;

REVOKE EXECUTE ON FUNCTION public.remap_character_avatars(uuid, jsonb) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.remap_character_avatars(uuid, jsonb) TO authenticated;
