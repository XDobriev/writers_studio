-- Авторская студия — фикс: снапшоты писались по UTC-дате сервера (current_date),
-- а клиент считает "сегодня" по локальному времени браузера (toLocalISODate).
-- С 00:00 до ~03:00 по Москве это давало рассинхрон: запись уходила под вчерашнюю
-- дату, и "слов сегодня"/streak не учитывали свежий прогресс до следующего сохранения.
-- Аудитория продукта — русскоязычная, единой пользовательской таймзоны нет, поэтому
-- фиксируем Europe/Moscow как ближайшее приближение вместо UTC.

create or replace function public.snapshot_book_words()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.words is distinct from old.words then
    insert into public.writing_snapshots (book_id, user_id, date, words)
    values (new.id, new.user_id, (timezone('Europe/Moscow', now()))::date, new.words)
    on conflict (book_id, date) do update set words = excluded.words;
  end if;
  return new;
end;
$$;

create or replace function public.snapshot_book_on_create()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.writing_snapshots (book_id, user_id, date, words)
  values (new.id, new.user_id, (timezone('Europe/Moscow', now()))::date, 0)
  on conflict (book_id, date) do nothing;
  return new;
end;
$$;
