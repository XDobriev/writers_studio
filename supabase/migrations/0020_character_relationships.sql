-- Авторская студия — двухсторонние связи персонажей
-- Заменяет directional character_relations новой симметричной схемой.
-- char_a_id < char_b_id (каноническое хранение, UUID-порядок).
-- label_a — как A видит B; label_b — как B видит A (пусто = симметрия).

create table if not exists public.character_relationships (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  char_a_id uuid not null references public.characters(id) on delete cascade,
  char_b_id uuid not null references public.characters(id) on delete cascade,
  label_a text not null default '',
  label_b text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint character_relationships_no_self check (char_a_id <> char_b_id),
  constraint character_relationships_canonical check (char_a_id::text < char_b_id::text),
  constraint character_relationships_unique unique (char_a_id, char_b_id)
);

create index if not exists character_relationships_book_id_idx on public.character_relationships(book_id);
create index if not exists character_relationships_char_a_idx on public.character_relationships(char_a_id);
create index if not exists character_relationships_char_b_idx on public.character_relationships(char_b_id);

drop trigger if exists character_relationships_touch_updated_at on public.character_relationships;
create trigger character_relationships_touch_updated_at
  before update on public.character_relationships
  for each row execute function public.touch_updated_at();

alter table public.character_relationships enable row level security;

drop policy if exists "character_relationships select own" on public.character_relationships;
create policy "character_relationships select own"
  on public.character_relationships for select
  using (auth.uid() = user_id);

drop policy if exists "character_relationships insert own" on public.character_relationships;
create policy "character_relationships insert own"
  on public.character_relationships for insert
  with check (auth.uid() = user_id);

drop policy if exists "character_relationships update own" on public.character_relationships;
create policy "character_relationships update own"
  on public.character_relationships for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "character_relationships delete own" on public.character_relationships;
create policy "character_relationships delete own"
  on public.character_relationships for delete
  using (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.character_relationships TO anon, authenticated;

-- Мигрировать существующие данные из character_relations
insert into public.character_relationships (book_id, user_id, char_a_id, char_b_id, label_a, label_b, created_at, updated_at)
select
  r.book_id,
  r.user_id,
  least(r.from_character_id::text, r.to_character_id::text)::uuid,
  greatest(r.from_character_id::text, r.to_character_id::text)::uuid,
  case when r.from_character_id::text < r.to_character_id::text then r.label else '' end,
  case when r.from_character_id::text > r.to_character_id::text then r.label else '' end,
  r.created_at,
  r.updated_at
from public.character_relations r
on conflict (char_a_id, char_b_id) do nothing;
