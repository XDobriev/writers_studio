-- §security: get_shared_book возвращала row_to_json(v_book), что раскрывало
-- анонимным вызывающим user_id владельца и сам share_token.
-- Исправление: явный json_build_object только с публичными полями (как уже
-- сделано для chapters в 0014_secure_share_rpc.sql).

create or replace function public.get_shared_book(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book public.books%rowtype;
  v_chapters json;
begin
  select * into v_book
  from public.books
  where share_token = p_token;

  if not found then
    return null;
  end if;

  select json_agg(
    json_build_object(
      'id',       c.id,
      'title',    c.title,
      'position', c.position,
      'content',  c.content,
      'words',    c.words
    ) order by c.position
  )
  into v_chapters
  from public.chapters c
  where c.book_id = v_book.id;

  return json_build_object(
    'book', json_build_object(
      'id',         v_book.id,
      'title',      v_book.title,
      'author',     v_book.author,
      'genre',      v_book.genre,
      'words',      v_book.words,
      'goal',       v_book.goal,
      'cover',      v_book.cover,
      'map_bg_url', v_book.map_bg_url,
      'created_at', v_book.created_at
    ),
    'chapters', coalesce(v_chapters, '[]'::json)
  );
end;
$$;
