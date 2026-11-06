-- F-14/F-3: baseline + chapter milestones; deleted chapters retain their notes.
begin;

alter table public.character_relationships add column is_secret boolean not null default false;

create table public.character_relationship_events (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  relationship_id uuid not null references public.character_relationships(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete set null,
  chapter_title text not null default '',
  label_a text not null default '',
  label_b text not null default '',
  is_secret boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint relationship_event_labels_length check (char_length(label_a) <= 200 and char_length(label_b) <= 200),
  constraint relationship_event_note_length check (char_length(note) <= 4000)
);

create unique index relationship_events_chapter_unique on public.character_relationship_events(relationship_id, chapter_id) where chapter_id is not null;
create index relationship_events_book_idx on public.character_relationship_events(book_id);
create index relationship_events_user_idx on public.character_relationship_events(user_id);
create index relationship_events_chapter_idx on public.character_relationship_events(chapter_id);

create function public.capture_relationship_chapter_title() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.chapter_id is not null then
    select c.title into new.chapter_title from public.chapters c
      where c.id = new.chapter_id and c.book_id = new.book_id and c.user_id = new.user_id;
    if not found then raise exception 'chapter does not belong to relationship book' using errcode = '23503'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.capture_relationship_chapter_title() from public, anon, authenticated;
create trigger relationship_event_chapter_title before insert or update of chapter_id, book_id, user_id
  on public.character_relationship_events for each row execute function public.capture_relationship_chapter_title();
create trigger relationship_event_updated_at before update on public.character_relationship_events
  for each row execute function public.touch_updated_at();

alter table public.character_relationship_events enable row level security;
revoke all on public.character_relationship_events from public, anon, authenticated;
grant select, insert, update, delete on public.character_relationship_events to authenticated;

create policy "relationship events select own" on public.character_relationship_events for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "relationship events delete own" on public.character_relationship_events for delete to authenticated
  using ((select auth.uid()) = user_id);
create policy "relationship events insert own" on public.character_relationship_events for insert to authenticated
  with check (
    (select auth.uid()) = user_id and chapter_id is not null
    and exists (select 1 from public.character_relationships r where r.id = relationship_id and r.book_id = character_relationship_events.book_id and r.user_id = (select auth.uid()))
    and exists (select 1 from public.chapters c where c.id = chapter_id and c.book_id = character_relationship_events.book_id and c.user_id = (select auth.uid()))
  );
create policy "relationship events update own" on public.character_relationship_events for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.character_relationships r where r.id = relationship_id and r.book_id = character_relationship_events.book_id and r.user_id = (select auth.uid()))
    and (chapter_id is null or exists (select 1 from public.chapters c where c.id = chapter_id and c.book_id = character_relationship_events.book_id and c.user_id = (select auth.uid())))
  );

-- The UI only offers characters in this book; enforce the same boundary for direct API writes.
create policy "relationship characters in book" on public.character_relationships as restrictive for all to authenticated
  using (true)
  with check (
    exists (select 1 from public.characters c where c.id = char_a_id and c.book_id = character_relationships.book_id and c.user_id = (select auth.uid()))
    and exists (select 1 from public.characters c where c.id = char_b_id and c.book_id = character_relationships.book_id and c.user_id = (select auth.uid()))
  );

-- A continuation starts with the final state; source chapter history stays in the source book.
CREATE OR REPLACE FUNCTION public.duplicate_book_content(p_source uuid, p_target uuid, p_characters boolean, p_locations_map boolean, p_notes boolean, p_timeline boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid    uuid := auth.uid();
  v_series uuid;
  v_order  int;
begin
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
  -- Перенос только в пустую книгу: повторный вызов (двойной клик) задваивал содержимое.
  if exists (select 1 from public.characters where book_id = p_target)
     or exists (select 1 from public.locations where book_id = p_target)
     or exists (select 1 from public.notes where book_id = p_target)
     or exists (select 1 from public.timeline_events where book_id = p_target)
     or exists (select 1 from public.map_stamps where book_id = p_target) then
    raise exception 'target not empty' using errcode = 'P0001';
  end if;

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

    insert into public.character_relationships
      (id, book_id, user_id, char_a_id, char_b_id, label_a, label_b, is_secret)
    select gen_random_uuid(), p_target, v_uid,
      case when ma.new_id < mb.new_id then ma.new_id else mb.new_id end,
      case when ma.new_id < mb.new_id then mb.new_id else ma.new_id end,
      case when ma.new_id < mb.new_id then coalesce(last_event.label_a, r.label_a) else coalesce(last_event.label_b, r.label_b) end,
      case when ma.new_id < mb.new_id then coalesce(last_event.label_b, r.label_b) else coalesce(last_event.label_a, r.label_a) end,
      coalesce(last_event.is_secret, r.is_secret)
    from public.character_relationships r
    join _cmap ma on ma.old_id = r.char_a_id
    join _cmap mb on mb.old_id = r.char_b_id
    left join lateral (
      select e.label_a, e.label_b, e.is_secret
      from public.character_relationship_events e
      join public.chapters chapter on chapter.id = e.chapter_id and chapter.book_id = p_source and chapter.user_id = v_uid
      where e.relationship_id = r.id and e.book_id = p_source
      order by chapter.position desc, chapter.created_at desc, chapter.id desc
      limit 1
    ) last_event on true
    where r.book_id = p_source;
  end if;

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

    update public.books t
      set map_bg_url = s.map_bg_url, map_template = s.map_template
    from public.books s
    where t.id = p_target and s.id = p_source;
  end if;

  if p_notes then
    insert into public.notes
      (id, book_id, user_id, kind, text, position, custom_color, custom_label, chapter_id, created_at)
    select gen_random_uuid(), p_target, v_uid, n.kind, n.text, n.position,
       n.custom_color, n.custom_label, null, n.created_at
    from public.notes n
    where n.book_id = p_source;
  end if;

  if p_timeline then
    insert into public.timeline_events
      (id, book_id, user_id, title, description, type, era, position, chapter_id)
    select gen_random_uuid(), p_target, v_uid, e.title, e.description, e.type,
       e.era, e.position, null
    from public.timeline_events e
    where e.book_id = p_source;
  end if;

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
$function$;

revoke all on function public.duplicate_book_content(uuid, uuid, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.duplicate_book_content(uuid, uuid, boolean, boolean, boolean, boolean) to authenticated;

commit;
