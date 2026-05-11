-- Авторская студия — chapters
-- Главы книги с HTML-контентом. Сцены — позже, в Заходе 3.

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Без названия',
  position integer not null default 0,
  content text not null default '',
  words integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'progress', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chapters_book_id_idx on public.chapters(book_id);
create index if not exists chapters_user_id_idx on public.chapters(user_id);
create index if not exists chapters_book_position_idx on public.chapters(book_id, position);

drop trigger if exists chapters_touch_updated_at on public.chapters;
create trigger chapters_touch_updated_at
  before update on public.chapters
  for each row execute function public.touch_updated_at();

alter table public.chapters enable row level security;

drop policy if exists "chapters select own" on public.chapters;
create policy "chapters select own"
  on public.chapters for select
  using (auth.uid() = user_id);

drop policy if exists "chapters insert own" on public.chapters;
create policy "chapters insert own"
  on public.chapters for insert
  with check (auth.uid() = user_id);

drop policy if exists "chapters update own" on public.chapters;
create policy "chapters update own"
  on public.chapters for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "chapters delete own" on public.chapters;
create policy "chapters delete own"
  on public.chapters for delete
  using (auth.uid() = user_id);
