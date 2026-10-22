-- Точка отсчёта статистики для импортированной рукописи.
-- Импорт создаёт книгу с готовым текстом: без отсчёта весь объём засчитывался
-- как «написано сегодня» — скачок на тепловой карте, ложная дневная цель и серия.
-- Клиент (activity.ts, useWritingStats.ts) считает дельты от imported_words,
-- если более раннего снапшота нет.
--
-- ROLLBACK: alter table public.books drop column if exists imported_words;

alter table public.books
  add column if not exists imported_words integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'books_imported_words_nonneg'
  ) then
    alter table public.books
      add constraint books_imported_words_nonneg check (imported_words >= 0);
  end if;
end $$;
