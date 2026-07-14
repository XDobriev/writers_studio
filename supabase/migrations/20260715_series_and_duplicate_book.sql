-- Серия книг + перенос данных в продолжение (R7)
-- Спек: docs/superpowers/specs/2026-07-15-series-continuation-design.md
-- Модель: копирование. Книги независимы после переноса.

-- ── 1. Таблица series ────────────────────────────────────────────────
create table if not exists public.series (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  created_at timestamptz not null default now()
);

create index if not exists series_user_id_idx on public.series(user_id);

alter table public.series enable row level security;

drop policy if exists series_owner on public.series;
create policy series_owner on public.series
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- GRANT обязателен (правило CLAUDE.md, дедлайн 30.10.2026)
grant select, insert, update, delete on table public.series to anon, authenticated;

-- ── 2. Расширение books ──────────────────────────────────────────────
alter table public.books
  add column if not exists series_id    uuid references public.series(id) on delete set null,
  add column if not exists series_order int;

create index if not exists books_series_id_idx on public.books(series_id);

-- ── 3. RPC копирования содержимого книги ─────────────────────────────
create or replace function public.duplicate_book_content(
  p_source        uuid,
  p_target        uuid,
  p_characters    boolean,
  p_locations_map boolean,
  p_notes         boolean,
  p_timeline      boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_series uuid;
  v_order  int;
begin
  -- Guard: репо публичный, анон-ключ открыт → проверяем владельца
  if v_uid is null then
    raise exception 'unauthenticated';
  end if;
  if p_source = p_target then
    raise exception 'source equals target';
  end if;
  if (select user_id from public.books where id = p_source) is distinct from v_uid then
    raise exception 'forbidden';
  end if;
  if (select user_id from public.books where id = p_target) is distinct from v_uid then
    raise exception 'forbidden';
  end if;

  -- ── Персонажи + связи ──────────────────────────────────────────────
  if p_characters then
    create temp table _cmap (old_id uuid, new_id uuid) on commit drop;
    insert into _cmap
      select id, gen_random_uuid() from public.characters where book_id = p_source;

    insert into public.characters
      (id, book_id, user_id, name, aliases, role, position, quote, age,
       appearance, personality, backstory, notes, gap, interior_life,
       exterior_life, avatar_url)
    select m.new_id, p_target, v_uid, c.name, c.aliases, c.role, c.position,
       c.quote, c.age, c.appearance, c.personality, c.backstory, c.notes,
       c.gap, c.interior_life, c.exterior_life, c.avatar_url
    from public.characters c
    join _cmap m on m.old_id = c.id;

    -- Направленные связи (remap обоих концов)
    insert into public.character_relations
      (id, book_id, user_id, from_character_id, to_character_id, label)
    select gen_random_uuid(), p_target, v_uid, mf.new_id, mt.new_id, r.label
    from public.character_relations r
    join _cmap mf on mf.old_id = r.from_character_id
    join _cmap mt on mt.old_id = r.to_character_id
    where r.book_id = p_source;

    -- Двусторонние связи: remap + пересортировка char_a<char_b + swap меток
    insert into public.character_relationships
      (id, book_id, user_id, char_a_id, char_b_id, label_a, label_b)
    select gen_random_uuid(), p_target, v_uid,
      case when ma.new_id < mb.new_id then ma.new_id else mb.new_id end,
      case when ma.new_id < mb.new_id then mb.new_id else ma.new_id end,
      case when ma.new_id < mb.new_id then r.label_a else r.label_b end,
      case when ma.new_id < mb.new_id then r.label_b else r.label_a end
    from public.character_relationships r
    join _cmap ma on ma.old_id = r.char_a_id
    join _cmap mb on mb.old_id = r.char_b_id
    where r.book_id = p_source;
  end if;

  -- ── Локации + связи + штампы + фон/шаблон карты ────────────────────
  if p_locations_map then
    create temp table _lmap (old_id uuid, new_id uuid) on commit drop;
    insert into _lmap
      select id, gen_random_uuid() from public.locations where book_id = p_source;

    insert into public.locations
      (id, book_id, user_id, name, description, type, role, size, position, x, y)
    select m.new_id, p_target, v_uid, l.name, l.description, l.type, l.role,
       l.size, l.position, l.x, l.y
    from public.locations l
    join _lmap m on m.old_id = l.id;

    insert into public.location_connections
      (id, book_id, user_id, from_id, to_id, label, style)
    select gen_random_uuid(), p_target, v_uid, mf.new_id, mt.new_id, c.label, c.style
    from public.location_connections c
    join _lmap mf on mf.old_id = c.from_id
    join _lmap mt on mt.old_id = c.to_id
    where c.book_id = p_source;

    insert into public.map_stamps
      (id, book_id, user_id, type, size, x, y)
    select gen_random_uuid(), p_target, v_uid, s.type, s.size, s.x, s.y
    from public.map_stamps s
    where s.book_id = p_source;

    -- Фон/шаблон карты: URL общий (read-only ссылка на файл Storage)
    update public.books t
      set map_bg_url = s.map_bg_url, map_template = s.map_template
    from public.books s
    where t.id = p_target and s.id = p_source;
  end if;

  -- ── Заметки (chapter_id обнуляем — главы не переносим) ─────────────
  if p_notes then
    insert into public.notes
      (id, book_id, user_id, kind, text, position, custom_color, custom_label, chapter_id)
    select gen_random_uuid(), p_target, v_uid, n.kind, n.text, n.position,
       n.custom_color, n.custom_label, null
    from public.notes n
    where n.book_id = p_source;
  end if;

  -- ── Хронология (chapter_id обнуляем) ──────────────────────────────
  if p_timeline then
    insert into public.timeline_events
      (id, book_id, user_id, title, description, type, era, position, chapter_id)
    select gen_random_uuid(), p_target, v_uid, e.title, e.description, e.type,
       e.era, e.position, null
    from public.timeline_events e
    where e.book_id = p_source;
  end if;

  -- ── Связывание серии ──────────────────────────────────────────────
  select series_id into v_series from public.books where id = p_source;
  if v_series is null then
    insert into public.series (user_id, title)
      select v_uid, title from public.books where id = p_source
      returning id into v_series;
    update public.books set series_id = v_series, series_order = 1 where id = p_source;
  end if;
  select coalesce(max(series_order), 0) + 1 into v_order
    from public.books where series_id = v_series;
  update public.books set series_id = v_series, series_order = v_order where id = p_target;
end;
$$;

revoke execute on function public.duplicate_book_content(uuid, uuid, boolean, boolean, boolean, boolean) from anon, public;
grant  execute on function public.duplicate_book_content(uuid, uuid, boolean, boolean, boolean, boolean) to authenticated;
