-- Авторская студия — daily snapshots объёма книги для графиков дэшборда.
-- На каждое изменение books.words апсёртим строку (book_id, date=today, words).

create table if not exists public.writing_snapshots (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  words integer not null,
  created_at timestamptz not null default now(),
  constraint writing_snapshots_unique unique (book_id, date)
);

create index if not exists writing_snapshots_book_date_idx on public.writing_snapshots(book_id, date desc);
create index if not exists writing_snapshots_user_id_idx on public.writing_snapshots(user_id);

alter table public.writing_snapshots enable row level security;

drop policy if exists "writing_snapshots select own" on public.writing_snapshots;
create policy "writing_snapshots select own" on public.writing_snapshots for select using (auth.uid() = user_id);

-- Триггер на UPDATE books.words → UPSERT снимок за сегодня.
create or replace function public.snapshot_book_words()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.words is distinct from old.words then
    insert into public.writing_snapshots (book_id, user_id, date, words)
    values (new.id, new.user_id, current_date, new.words)
    on conflict (book_id, date) do update set words = excluded.words;
  end if;
  return new;
end;
$$;

drop trigger if exists books_snapshot_words on public.books;
create trigger books_snapshot_words
  after update of words on public.books
  for each row execute function public.snapshot_book_words();

-- Backfill: для уже существующих книг создаём снимок за сегодня с текущим words.
insert into public.writing_snapshots (book_id, user_id, date, words)
select id, user_id, current_date, words from public.books
on conflict (book_id, date) do nothing;
