-- ==============================================================================
-- Подготовка к отзыву EXECUTE у роли authenticated для функций SECURITY DEFINER
-- Найдено аудитом безопасности Supabase Advisors (.qa/night/2026-11-02/supabase-report.md)
--
-- ПРЕДУПРЕЖДЕНИЕ И АРХИТЕКТУРНЫЙ КОНТЕКСТ:
-- 1. Административная панель (/admin) работает как SPA, где администратор
--    авторизуется через Supabase Auth и подключается к PostgREST под ролью authenticated
--    с проверенным клеймом JWT `app_metadata.role = 'admin'`.
-- 2. Все административные функции ниже УЖЕ защищены на уровне функции проверкой:
--    `IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';`
-- 3. Вызов `REVOKE EXECUTE ... FROM authenticated` отзывает право запуска функции
--    до проверки `is_admin()`. Если применить эту миграцию к боевой базе БЕЗ
--    проксирующей Edge Function (работающей под service_role), административная панель
--    в браузере получит ошибку 42501 (permission denied for function).
-- 4. Чтобы применить эту миграцию в продакшене, предварительно необходимо перевести вызовы
--    из src/lib/admin.ts на защищённую Edge Function с сервисным ключом service_role.
-- ==============================================================================

-- 1. Административная аналитика и чтение данных
REVOKE EXECUTE ON FUNCTION public.get_admin_stats() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_users() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_user_detail(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_revenue() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_audit_log() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_cancellations() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_dau_trend() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_retention() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_anomalies() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_activation_funnel() FROM authenticated;

-- 2. Административные мутации и управление пользователями
REVOKE EXECUTE ON FUNCTION public.set_feature_flag(text, boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_lifetime_slots(integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_user_plan(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_user_test(uuid, boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.suspend_user(uuid, boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.extend_plan(uuid, integer) FROM authenticated;

-- 3. Явное подтверждение прав для служебной роли service_role
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_users() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_user_detail(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_revenue() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_audit_log() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_cancellations() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_dau_trend() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_retention() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_anomalies() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_activation_funnel() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_feature_flag(text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_lifetime_slots(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_user_plan(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_user_test(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.suspend_user(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.extend_plan(uuid, integer) TO service_role;

-- ------------------------------------------------------------------------------
-- ОТКАТ (ROLLBACK):
-- GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.get_admin_users() TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.get_admin_user_detail(uuid) TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.get_admin_revenue() TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.get_admin_audit_log() TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.get_admin_cancellations() TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.get_admin_dau_trend() TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.get_admin_retention() TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.get_admin_anomalies() TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.get_admin_activation_funnel() TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.set_feature_flag(text, boolean) TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.set_lifetime_slots(integer) TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.set_user_plan(uuid, text) TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.set_user_test(uuid, boolean) TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.suspend_user(uuid, boolean) TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.extend_plan(uuid, integer) TO authenticated;
-- ------------------------------------------------------------------------------
