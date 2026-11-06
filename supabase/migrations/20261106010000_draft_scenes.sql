-- Буфер свободных сцен / Ловец мыслей (F-13)
-- Сцены и фрагменты прозы книги вне жёсткой структуры глав, с последующим переносом в рукопись.

create table if not exists public.draft_scenes (
  id         uuid primary key default gen_random_uuid(),
  book_id    uuid not null references public.books(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null default 'Без названия',
  content    text not null default '',
  words      integer not null default 0,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists draft_scenes_book_id_idx on public.draft_scenes(book_id);
create index if not exists draft_scenes_user_id_idx on public.draft_scenes(user_id);
create index if not exists draft_scenes_book_position_idx on public.draft_scenes(book_id, position);

drop trigger if exists draft_scenes_touch_updated_at on public.draft_scenes;
create trigger draft_scenes_touch_updated_at
  before update on public.draft_scenes
  for each row execute function public.touch_updated_at();

alter table public.draft_scenes enable row level security;

drop policy if exists "draft_scenes: owner access" on public.draft_scenes;
create policy "draft_scenes: owner access" on public.draft_scenes for all
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and book_id in (select id from public.books where user_id = (select auth.uid()))
  );

grant select, insert, update, delete on table public.draft_scenes to anon, authenticated;
