-- Закрытие двух эксплойтов на публичном анон-ключе (репозиторий стал публичным).
-- Применено через Supabase MCP; файл — для паритета истории миграций.
--
-- 1. decrement_lifetime_slot — SECURITY DEFINER без guard, вызывается только из
--    robokassa-webhook (service_role). EXECUTE был выдан роли PUBLIC → любой с
--    анон-ключом мог обнулить счётчик Lifetime-слотов без оплаты (denial of inventory).
-- 2. get_inactive_users_for_retention — возвращает email/имя/книгу неактивных
--    пользователей; нужна только retention-email (service_role). Имела прямые
--    гранты anon/authenticated → выгрузка PII публичным ключом.
--
-- service_role обходит проверки GRANT, поэтому обе серверные функции продолжают работать.

REVOKE EXECUTE ON FUNCTION public.decrement_lifetime_slot() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.decrement_lifetime_slot() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_inactive_users_for_retention() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_inactive_users_for_retention() TO service_role;
