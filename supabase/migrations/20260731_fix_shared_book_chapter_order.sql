-- Порядок глав на публичной странице /share/:token расходился с порядком в
-- редакторе: fetchChapters() сортирует по position, затем created_at
-- (src/lib/chapters.ts), а get_shared_book сортировал только по position —
-- при совпадающих значениях position (0/0) порядок был не детерминирован.
create or replace function public.get_shared_book(p_token uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    ) order by c.position, c.created_at
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
$function$;
