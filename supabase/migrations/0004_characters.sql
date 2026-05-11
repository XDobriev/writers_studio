-- Авторская студия — characters
-- Картотека персонажей. Связи и «в каких главах появляется» — отдельный заход.

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Без имени',
  role text not null default 'minor' check (role in ('protagonist', 'secondary', 'minor')),
  age integer,
  quote text not null default '',
  appearance text not null default '',
  personality text not null default '',
  backstory text not null default '',
  notes text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists characters_book_id_idx on public.characters(book_id);
create index if not exists characters_user_id_idx on public.characters(user_id);
create index if not exists characters_book_position_idx on public.characters(book_id, position);

drop trigger if exists characters_touch_updated_at on public.characters;
create trigger characters_touch_updated_at
  before update on public.characters
  for each row execute function public.touch_updated_at();

alter table public.characters enable row level security;

drop policy if exists "characters select own" on public.characters;
create policy "characters select own"
  on public.characters for select
  using (auth.uid() = user_id);

drop policy if exists "characters insert own" on public.characters;
create policy "characters insert own"
  on public.characters for insert
  with check (auth.uid() = user_id);

drop policy if exists "characters update own" on public.characters;
create policy "characters update own"
  on public.characters for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "characters delete own" on public.characters;
create policy "characters delete own"
  on public.characters for delete
  using (auth.uid() = user_id);
