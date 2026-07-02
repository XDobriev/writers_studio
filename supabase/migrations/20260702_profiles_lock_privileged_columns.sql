-- Fix privilege escalation: authenticated мог править plan/grandfathered/is_test/plan_expires_at
-- напрямую через profiles UPDATE (RLS проверяет только auth.uid()=user_id, не колонки).

-- 1. authenticated: снять полный UPDATE, вернуть только реально пишущиеся клиентом колонки
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (onboarded_at, display_name) ON public.profiles TO authenticated;

-- 2. authenticated: INSERT/DELETE клиенту не нужны
--    (профиль создаёт SECURITY DEFINER-триггер handle_new_user_profile; удаление — только серверно).
--    Закрывает вторичный вектор эскалации через INSERT plan:'lifetime'.
REVOKE INSERT, DELETE ON public.profiles FROM authenticated;

-- 3. anon: никакой записи в profiles (RLS и так блокирует, убираем мёртвый грант)
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon;
