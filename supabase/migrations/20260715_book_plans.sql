-- Замысел книги (R9)
-- Спек: docs/superpowers/specs/2026-07-15-book-plan-design.md
-- Один rich-text документ на книгу. Полей нет — вся структура живёт внутри HTML.
-- Принципы уровня серии (series_principles) — отдельным шагом, не в v1.

create table if not exists public.book_plans (
  id         uuid primary key default gen_random_uuid(),
  book_id    uuid not null references public.books(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  content    text not null default '',
  updated_at timestamptz not null default now(),
  unique (book_id)
);

-- unique (book_id) уже создаёт btree-индекс на book_id — отдельный не нужен.
create index if not exists book_plans_user_id_idx on public.book_plans(user_id);

drop trigger if exists book_plans_touch_updated_at on public.book_plans;
create trigger book_plans_touch_updated_at
  before update on public.book_plans
  for each row execute function public.touch_updated_at();

alter table public.book_plans enable row level security;

-- Одна ALL-политика: USING закрывает SELECT/UPDATE/DELETE по владельцу,
-- WITH CHECK на INSERT/UPDATE дополнительно требует, чтобы book_id принадлежал
-- книге этого же пользователя (образец: M3 / M3b — 20260630 / 20260702).
drop policy if exists "book_plans: owner access" on public.book_plans;
create policy "book_plans: owner access" on public.book_plans for all
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and book_id in (select id from public.books where user_id = (select auth.uid()))
  );

-- GRANT обязателен (правило CLAUDE.md, дедлайн 30.10.2026)
grant select, insert, update, delete on table public.book_plans to anon, authenticated;
