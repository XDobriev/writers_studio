-- §14 Безопасный доступ к расшаренным книгам через RPC
-- Заменяет небезопасные RLS-политики (share_token is not null),
-- которые позволяли анонимным пользователям читать все расшаренные книги без знания токена.

drop policy if exists "books select via share token" on public.books;
drop policy if exists "chapters select via share token" on public.chapters;

-- RPC: возвращает книгу + главы только если передан точный токен
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
    'book',     row_to_json(v_book),
    'chapters', coalesce(v_chapters, '[]'::json)
  );
end;
$$;

grant execute on function public.get_shared_book(uuid) to anon, authenticated;
