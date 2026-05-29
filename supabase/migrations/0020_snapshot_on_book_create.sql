-- При создании новой книги вносим базовую запись words=0 за сегодня.
-- Без неё первое сохранение текста показывает delta = весь объём книги
-- (нет предыдущего снапшота, с которым считать разницу).

create or replace function public.snapshot_book_on_create()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.writing_snapshots (book_id, user_id, date, words)
  values (new.id, new.user_id, current_date, 0)
  on conflict (book_id, date) do nothing;
  return new;
end;
$$;

drop trigger if exists books_snapshot_on_create on public.books;
create trigger books_snapshot_on_create
  after insert on public.books
  for each row execute function public.snapshot_book_on_create();
