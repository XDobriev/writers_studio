-- Авторская студия — связи персонажей и появление в главах

create table if not exists public.character_relations (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  from_character_id uuid not null references public.characters(id) on delete cascade,
  to_character_id uuid not null references public.characters(id) on delete cascade,
  label text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint character_relations_no_self check (from_character_id <> to_character_id),
  constraint character_relations_unique unique (from_character_id, to_character_id)
);

create index if not exists character_relations_book_id_idx on public.character_relations(book_id);
create index if not exists character_relations_from_idx on public.character_relations(from_character_id);
create index if not exists character_relations_to_idx on public.character_relations(to_character_id);

drop trigger if exists character_relations_touch_updated_at on public.character_relations;
create trigger character_relations_touch_updated_at
  before update on public.character_relations
  for each row execute function public.touch_updated_at();

alter table public.character_relations enable row level security;

drop policy if exists "character_relations select own" on public.character_relations;
create policy "character_relations select own"
  on public.character_relations for select
  using (auth.uid() = user_id);

drop policy if exists "character_relations insert own" on public.character_relations;
create policy "character_relations insert own"
  on public.character_relations for insert
  with check (auth.uid() = user_id);

drop policy if exists "character_relations update own" on public.character_relations;
create policy "character_relations update own"
  on public.character_relations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "character_relations delete own" on public.character_relations;
create policy "character_relations delete own"
  on public.character_relations for delete
  using (auth.uid() = user_id);


create table if not exists public.chapter_characters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint chapter_characters_unique unique (chapter_id, character_id)
);

create index if not exists chapter_characters_book_id_idx on public.chapter_characters(book_id);
create index if not exists chapter_characters_chapter_idx on public.chapter_characters(chapter_id);
create index if not exists chapter_characters_character_idx on public.chapter_characters(character_id);

alter table public.chapter_characters enable row level security;

drop policy if exists "chapter_characters select own" on public.chapter_characters;
create policy "chapter_characters select own"
  on public.chapter_characters for select
  using (auth.uid() = user_id);

drop policy if exists "chapter_characters insert own" on public.chapter_characters;
create policy "chapter_characters insert own"
  on public.chapter_characters for insert
  with check (auth.uid() = user_id);

drop policy if exists "chapter_characters delete own" on public.chapter_characters;
create policy "chapter_characters delete own"
  on public.chapter_characters for delete
  using (auth.uid() = user_id);
