-- Таблица публичных настроек приложения: счётчик Lifetime-слотов и другие параметры.
-- SELECT открыт всем (anon/authenticated) — данные публичные (лендинг).
-- UPDATE/INSERT/DELETE только через service_role или SECURITY DEFINER функции.

CREATE TABLE IF NOT EXISTS public.app_settings (
  key   text PRIMARY KEY,
  value text NOT NULL
);

-- Начальное значение: 50 слотов Lifetime
INSERT INTO public.app_settings (key, value)
VALUES ('lifetime_slots_remaining', '50')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings select all"
  ON public.app_settings FOR SELECT
  USING (true);

GRANT SELECT ON TABLE public.app_settings TO anon, authenticated;

-- Атомарный декремент слота Lifetime.
-- Возвращает true если слот успешно занят, false если слоты закончились.
-- Вызывается из Edge Function через service_role (SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.decrement_lifetime_slot()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_val integer;
BEGIN
  SELECT (value::integer) INTO current_val
  FROM public.app_settings
  WHERE key = 'lifetime_slots_remaining'
  FOR UPDATE;

  IF current_val IS NULL OR current_val <= 0 THEN
    RETURN false;
  END IF;

  UPDATE public.app_settings
  SET value = (current_val - 1)::text
  WHERE key = 'lifetime_slots_remaining';

  RETURN true;
END;
$$;
