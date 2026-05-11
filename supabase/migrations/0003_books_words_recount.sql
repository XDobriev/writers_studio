-- Авторская студия — пересчёт books.words по сумме слов в главах.
-- После каждого insert/update/delete в chapters обновляем books.words.

create or replace function public.recount_book_words()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target_book uuid;
begin
  target_book := coalesce(new.book_id, old.book_id);
  if target_book is null then
    return coalesce(new, old);
  end if;
  update public.books
    set words = coalesce((select sum(words) from public.chapters where book_id = target_book), 0)
    where id = target_book;
  return coalesce(new, old);
end;
$$;

drop trigger if exists chapters_recount_book_words on public.chapters;
create trigger chapters_recount_book_words
  after insert or update of words or delete on public.chapters
  for each row execute function public.recount_book_words();
