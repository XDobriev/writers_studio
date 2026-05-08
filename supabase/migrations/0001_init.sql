-- Авторская студия — initial schema
-- Run in Supabase: SQL Editor → New query → paste → Run.

create extension if not exists "pgcrypto";

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  author text,
  genre text,
  words integer not null default 0,
  goal integer not null default 80000,
  cover text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists books_user_id_idx on public.books(user_id);
create index if not exists books_updated_at_idx on public.books(updated_at desc);

-- updated_at auto-touch
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists books_touch_updated_at on public.books;
create trigger books_touch_updated_at
  before update on public.books
  for each row execute function public.touch_updated_at();

-- Row-level security: каждый видит и правит только свои книги
alter table public.books enable row level security;

drop policy if exists "books select own" on public.books;
create policy "books select own"
  on public.books for select
  using (auth.uid() = user_id);

drop policy if exists "books insert own" on public.books;
create policy "books insert own"
  on public.books for insert
  with check (auth.uid() = user_id);

drop policy if exists "books update own" on public.books;
create policy "books update own"
  on public.books for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "books delete own" on public.books;
create policy "books delete own"
  on public.books for delete
  using (auth.uid() = user_id);
