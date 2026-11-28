-- Точный гибридный подсчёт слов «за сегодня» по документам (главам и свободным сценам).
--
-- Модель:
--  1. Внутри одной главы или свободной сцены за локальный день клиента — net_delta
--     (напечатал 20, удалил 10 → +10; переписывание не раздувает счётчик).
--  2. Между разными документами в один день: правка/сокращение одной главы не вычитается
--     из новых слов в другой — итог дня = SUM(GREATEST(0, net_delta)) по всем документам книги.
--  3. Системные/структурные операции (импорт рукописи, удаление главы, откат версии,
--     конвертация/вставка черновика в главу) не вызывают RPC и не меняют written_words.
--  4. Исторические строки writing_snapshots до миграции имеют written_words IS NULL —
--     клиент откатывается к legacy-дельте по words. Новые строки от триггеров получают
--     written_words = 0, чтобы структурные операции не вызывали ложных legacy-скачков.
--
-- ROLLBACK:
--   1. Сначала восстановить триггерные функции snapshot_book_words() и snapshot_book_on_create()
--      из 20260921110210_writing_snapshots_moscow_timezone.sql (без колонки written_words),
--      иначе после удаления колонки любая правка глав упадёт в триггере.
--   2. Затем выполнить:
--      drop function if exists public.record_writing_progress(uuid, date, text, uuid, integer);
--      drop table if exists public.writing_daily_progress;
--      alter table public.writing_snapshots drop constraint if exists writing_snapshots_written_words_nonneg;
--      alter table public.writing_snapshots drop column if exists written_words;

create table if not exists public.writing_daily_progress (
  book_id    uuid not null references public.books(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null,
  doc_kind   text not null check (doc_kind in ('chapter', 'draft', 'legacy')),
  doc_id     uuid not null,
  net_delta  integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (book_id, date, doc_kind, doc_id)
);

create index if not exists writing_daily_progress_user_id_idx
  on public.writing_daily_progress(user_id);

alter table public.writing_daily_progress enable row level security;

drop policy if exists "writing_daily_progress select own" on public.writing_daily_progress;
create policy "writing_daily_progress select own"
  on public.writing_daily_progress for select
  using ((select auth.uid()) = user_id);

revoke all on table public.writing_daily_progress from public, anon, authenticated;
grant select on table public.writing_daily_progress to authenticated;

alter table public.writing_snapshots
  add column if not exists written_words integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'writing_snapshots_written_words_nonneg'
  ) then
    alter table public.writing_snapshots
      add constraint writing_snapshots_written_words_nonneg
      check (written_words is null or written_words >= 0);
  end if;
end $$;

-- Триггеры обновляют только кумулятивный books.words (для графика объёма и админ-аналитики).
-- При вставке новой строки ставим written_words = 0 (не NULL), чтобы удаление/импорт/откат/
-- конвертация черновика не воспринимались клиентом как legacy-снапшот и не давали ложных дельт.
-- При конфликте: если written_words уже задан, не трогаем его; если это домиграционная строка
-- (written_words IS NULL), фиксируем её legacy-дельту ДО перезаписи words, чтобы структурные
-- операции в день миграции и правки после полуночи в часовых поясах восточнее Москвы не раздували
-- историческую клетку.
create or replace function public.snapshot_book_words()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.words is distinct from old.words then
    insert into public.writing_snapshots (book_id, user_id, date, words, written_words)
    values (new.id, new.user_id, (timezone('Europe/Moscow', now()))::date, new.words, 0)
    on conflict (book_id, date) do update
      set words = excluded.words,
          written_words = coalesce(
            public.writing_snapshots.written_words,
            greatest(
              0,
              public.writing_snapshots.words - coalesce(
                (
                  select s.words
                  from public.writing_snapshots s
                  where s.book_id = new.id
                    and s.date < public.writing_snapshots.date
                  order by s.date desc
                  limit 1
                ),
                coalesce(new.imported_words, 0)
              )
            )
          );
  end if;
  return new;
end;
$$;

create or replace function public.snapshot_book_on_create()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.writing_snapshots (book_id, user_id, date, words, written_words)
  values (new.id, new.user_id, (timezone('Europe/Moscow', now()))::date, 0, 0)
  on conflict (book_id, date) do nothing;
  return new;
end;
$$;

create or replace function public.record_writing_progress(
  p_book_id  uuid,
  p_date     date,
  p_doc_kind text,
  p_doc_id   uuid,
  p_delta    integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id        uuid;
  v_book_words     integer;
  v_imported_words integer;
  v_written_words  integer;
  v_snap_words     integer;
  v_snap_written   integer;
  v_legacy_written integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if p_doc_kind is null or p_doc_kind not in ('chapter', 'draft') then
    raise exception 'invalid doc_kind' using errcode = '22023';
  end if;

  if p_date is null or p_date < (current_date - 2) or p_date > (current_date + 2) then
    raise exception 'invalid date' using errcode = '22023';
  end if;

  if p_delta is null or p_delta < -500000 or p_delta > 500000 then
    raise exception 'invalid delta' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.books
    where id = p_book_id and user_id = v_user_id
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if p_doc_kind = 'chapter' then
    if not exists (
      select 1 from public.chapters
      where id = p_doc_id and book_id = p_book_id and user_id = v_user_id
    ) then
      raise exception 'unauthorized' using errcode = '42501';
    end if;
  else
    if not exists (
      select 1 from public.draft_scenes
      where id = p_doc_id and book_id = p_book_id and user_id = v_user_id
    ) then
      raise exception 'unauthorized' using errcode = '42501';
    end if;
  end if;

  if p_delta = 0 then
    select coalesce(sum(greatest(0, net_delta)), 0)::integer
      into v_written_words
    from public.writing_daily_progress
    where book_id = p_book_id and date = p_date;
    return v_written_words;
  end if;

  -- Сериализуем агрегацию по (book_id, date), чтобы одновременные сохранения
  -- двух глав (например, в Split-режиме) не перезаписали written_words и words друг друга.
  perform pg_advisory_xact_lock(hashtext(p_book_id::text || ':' || p_date::text));

  -- Читаем актуальный books.words уже под блокировкой, чтобы не перезаписать более свежий объём.
  select words, coalesce(imported_words, 0)
    into v_book_words, v_imported_words
  from public.books
  where id = p_book_id and user_id = v_user_id;

  if not found then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  -- Бесшовный перенос домиграционного прогресса в день деплоя миграции:
  -- если за (book_id, date) в writing_daily_progress ещё нет записей, но в writing_snapshots
  -- уже зафиксированы слова за этот день (до миграции), переносим их в служебную строку 'legacy',
  -- чтобы первая пост-миграционная правка не обнулила написанное ранее сегодня.
  if not exists (
    select 1 from public.writing_daily_progress
    where book_id = p_book_id and date = p_date
  ) then
    select words, written_words
      into v_snap_words, v_snap_written
    from public.writing_snapshots
    where book_id = p_book_id and date = p_date;

    if found then
      v_legacy_written := coalesce(
        v_snap_written,
        greatest(
          0,
          v_snap_words - coalesce(
            (
              select s.words
              from public.writing_snapshots s
              where s.book_id = p_book_id
                and s.date < p_date
              order by s.date desc
              limit 1
            ),
            v_imported_words
          )
        )
      );

      if v_legacy_written > 0 then
        insert into public.writing_daily_progress (
          book_id, user_id, date, doc_kind, doc_id, net_delta, updated_at
        )
        values (
          p_book_id, v_user_id, p_date, 'legacy', '00000000-0000-0000-0000-000000000000'::uuid, v_legacy_written, now()
        )
        on conflict (book_id, date, doc_kind, doc_id) do nothing;
      end if;
    end if;
  end if;

  insert into public.writing_daily_progress (
    book_id, user_id, date, doc_kind, doc_id, net_delta, updated_at
  )
  values (
    p_book_id, v_user_id, p_date, p_doc_kind, p_doc_id, p_delta, now()
  )
  on conflict (book_id, date, doc_kind, doc_id) do update
    set net_delta  = public.writing_daily_progress.net_delta + excluded.net_delta,
        updated_at = now();

  select coalesce(sum(greatest(0, net_delta)), 0)::integer
    into v_written_words
  from public.writing_daily_progress
  where book_id = p_book_id and date = p_date;

  insert into public.writing_snapshots (book_id, user_id, date, words, written_words)
  values (p_book_id, v_user_id, p_date, v_book_words, v_written_words)
  on conflict (book_id, date) do update
    set words         = excluded.words,
        written_words = excluded.written_words;

  return v_written_words;
end;
$$;

revoke all on function public.record_writing_progress(uuid, date, text, uuid, integer) from public;
revoke execute on function public.record_writing_progress(uuid, date, text, uuid, integer) from anon;
grant execute on function public.record_writing_progress(uuid, date, text, uuid, integer) to authenticated;
