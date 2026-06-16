-- admin_audit_log имел GRANT INSERT для всех authenticated пользователей.
-- Комментарий в 0027 говорил «только SECURITY DEFINER», но GRANT это опровергал.
-- Фикс: забираем INSERT у authenticated; данные пишутся только через SECURITY DEFINER RPC.
REVOKE INSERT ON TABLE public.admin_audit_log FROM authenticated;
