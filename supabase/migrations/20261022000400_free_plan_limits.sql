-- Серверные лимиты Free (раньше проверялись только в UI, обходились POST /rest/v1/books).
-- Лимиты зеркалят src/lib/profiles.ts getPlanLimits:
--   books           — 1 на пользователя;
--   characters      — 3 на книгу;
--   timeline_events — 10 на книгу.
-- Ошибка: RAISE 'plan_limit' USING ERRCODE 'P0001', DETAIL = имя таблицы.
-- Фронт ловит её (isPlanLimitError) и показывает UpgradePrompt.
-- Уже существующие сверх лимита строки (после понижения) не трогаются — блокируется
-- только создание новых. Advisory-lock исключает гонку двух параллельных вставок.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS books_free_plan_limit ON public.books;
--   DROP TRIGGER IF EXISTS characters_free_plan_limit ON public.characters;
--   DROP TRIGGER IF EXISTS timeline_events_free_plan_limit ON public.timeline_events;
--   DROP FUNCTION IF EXISTS public.enforce_free_plan_limits();

CREATE OR REPLACE FUNCTION public.enforce_free_plan_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_count integer;
  v_limit integer;
BEGIN
  IF public.is_paid(NEW.user_id) THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'books' THEN
    PERFORM pg_advisory_xact_lock(hashtext('plan_limit:books:' || NEW.user_id::text));
    SELECT count(*) INTO v_count FROM public.books WHERE user_id = NEW.user_id;
    v_limit := 1;
  ELSIF TG_TABLE_NAME = 'characters' THEN
    PERFORM pg_advisory_xact_lock(hashtext('plan_limit:characters:' || NEW.book_id::text));
    SELECT count(*) INTO v_count FROM public.characters WHERE book_id = NEW.book_id;
    v_limit := 3;
  ELSIF TG_TABLE_NAME = 'timeline_events' THEN
    PERFORM pg_advisory_xact_lock(hashtext('plan_limit:timeline:' || NEW.book_id::text));
    SELECT count(*) INTO v_count FROM public.timeline_events WHERE book_id = NEW.book_id;
    v_limit := 10;
  ELSE
    RETURN NEW;
  END IF;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'plan_limit' USING ERRCODE = 'P0001', DETAIL = TG_TABLE_NAME, HINT = 'upgrade';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_free_plan_limits() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS books_free_plan_limit ON public.books;
CREATE TRIGGER books_free_plan_limit
  BEFORE INSERT ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.enforce_free_plan_limits();

DROP TRIGGER IF EXISTS characters_free_plan_limit ON public.characters;
CREATE TRIGGER characters_free_plan_limit
  BEFORE INSERT ON public.characters
  FOR EACH ROW EXECUTE FUNCTION public.enforce_free_plan_limits();

DROP TRIGGER IF EXISTS timeline_events_free_plan_limit ON public.timeline_events;
CREATE TRIGGER timeline_events_free_plan_limit
  BEFORE INSERT ON public.timeline_events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_free_plan_limits();
