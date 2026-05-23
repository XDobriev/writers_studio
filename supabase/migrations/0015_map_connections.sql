-- §17 карта мира: фон + связи между локациями

alter table public.books
  add column if not exists map_bg_url text;

create table if not exists public.location_connections (
  id         uuid primary key default gen_random_uuid(),
  book_id    uuid not null references public.books(id)     on delete cascade,
  user_id    uuid not null references auth.users(id)       on delete cascade,
  from_id    uuid not null references public.locations(id) on delete cascade,
  to_id      uuid not null references public.locations(id) on delete cascade,
  label      text not null default '',
  style      text not null default 'road'
             check (style in ('road', 'river', 'path', 'border')),
  created_at timestamptz not null default now()
);

create index if not exists lconn_book_idx on public.location_connections(book_id);

alter table public.location_connections enable row level security;

create policy "lconn select own" on public.location_connections
  for select using (auth.uid() = user_id);
create policy "lconn insert own" on public.location_connections
  for insert with check (auth.uid() = user_id);
create policy "lconn update own" on public.location_connections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "lconn delete own" on public.location_connections
  for delete using (auth.uid() = user_id);
