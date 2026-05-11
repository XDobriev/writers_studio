-- Авторская студия — хронология событий

create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  era text not null default '',
  title text not null default 'Событие',
  description text not null default '',
  type text not null default 'plot' check (type in ('plot', 'character', 'world', 'other')),
  chapter_id uuid references public.chapters(id) on delete set null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists timeline_events_book_id_idx on public.timeline_events(book_id);
create index if not exists timeline_events_user_id_idx on public.timeline_events(user_id);
create index if not exists timeline_events_book_position_idx on public.timeline_events(book_id, position);

drop trigger if exists timeline_events_touch_updated_at on public.timeline_events;
create trigger timeline_events_touch_updated_at
  before update on public.timeline_events
  for each row execute function public.touch_updated_at();

alter table public.timeline_events enable row level security;

drop policy if exists "timeline_events select own" on public.timeline_events;
create policy "timeline_events select own"
  on public.timeline_events for select
  using (auth.uid() = user_id);

drop policy if exists "timeline_events insert own" on public.timeline_events;
create policy "timeline_events insert own"
  on public.timeline_events for insert
  with check (auth.uid() = user_id);

drop policy if exists "timeline_events update own" on public.timeline_events;
create policy "timeline_events update own"
  on public.timeline_events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "timeline_events delete own" on public.timeline_events;
create policy "timeline_events delete own"
  on public.timeline_events for delete
  using (auth.uid() = user_id);
