-- Авторская студия — локации (карта мира)
-- Координаты x/y пока опциональны — визуальная карта в следующий заход.

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Без названия',
  type text not null default 'other' check (type in ('city', 'village', 'forest', 'sea', 'castle', 'other')),
  role text not null default '',
  description text not null default '',
  x real,
  y real,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists locations_book_id_idx on public.locations(book_id);
create index if not exists locations_user_id_idx on public.locations(user_id);
create index if not exists locations_book_position_idx on public.locations(book_id, position);

drop trigger if exists locations_touch_updated_at on public.locations;
create trigger locations_touch_updated_at
  before update on public.locations
  for each row execute function public.touch_updated_at();

alter table public.locations enable row level security;

drop policy if exists "locations select own" on public.locations;
create policy "locations select own" on public.locations for select using (auth.uid() = user_id);

drop policy if exists "locations insert own" on public.locations;
create policy "locations insert own" on public.locations for insert with check (auth.uid() = user_id);

drop policy if exists "locations update own" on public.locations;
create policy "locations update own" on public.locations for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "locations delete own" on public.locations;
create policy "locations delete own" on public.locations for delete using (auth.uid() = user_id);
