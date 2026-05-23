-- Авторская студия — снимки контента глав (резервные копии + история версий)

create table if not exists public.chapter_versions (
  id          uuid primary key default gen_random_uuid(),
  chapter_id  uuid not null references public.chapters(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  content     text not null,
  word_count  integer,
  label       text,    -- NULL = авто-снимок; строка = именованная веха (Pro)
  trigger     text not null
    check (trigger in ('beforeunload', 'chapter_switch', 'timer', 'manual')),
  created_at  timestamptz not null default now()
);

create index if not exists chapter_versions_chapter_created_idx
  on public.chapter_versions (chapter_id, created_at desc);

create index if not exists chapter_versions_chapter_label_idx
  on public.chapter_versions (chapter_id, label)
  where label is not null;

alter table public.chapter_versions enable row level security;

drop policy if exists "chapter_versions select own" on public.chapter_versions;
create policy "chapter_versions select own"
  on public.chapter_versions for select
  using (auth.uid() = user_id);

drop policy if exists "chapter_versions insert own" on public.chapter_versions;
create policy "chapter_versions insert own"
  on public.chapter_versions for insert
  with check (auth.uid() = user_id);

drop policy if exists "chapter_versions delete own" on public.chapter_versions;
create policy "chapter_versions delete own"
  on public.chapter_versions for delete
  using (auth.uid() = user_id);
