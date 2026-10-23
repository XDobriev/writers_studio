-- Лишние права на запись у anon/authenticated (найдено аудитом оплаты 2026-10-23).
-- app_settings держит lifetime_slots_remaining: клиент её только читает, админ меняет
-- через SECURITY DEFINER RPC set_lifetime_slots. Сейчас запись режет RLS (политика
-- только на SELECT), но одна новая permissive-политика открыла бы счётчик слотов.
-- TRUNCATE RLS не проверяет вовсе; через PostgREST его не вызвать, отзываем на всякий.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.app_settings FROM anon, authenticated;
REVOKE TRUNCATE ON TABLE public.profiles, public.recurring_consents, public.cancellation_reasons
  FROM anon, authenticated;
