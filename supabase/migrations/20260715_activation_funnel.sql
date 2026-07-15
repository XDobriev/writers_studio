-- Активация вместо регистраций.
--
-- До этой миграции onboarded_at ставился и при завершении всех шагов чеклиста,
-- и при закрытии его крестиком — активированного пользователя нельзя было отличить
-- от того, кто прогнал баннер. Разводим два события.
--
-- Шаги «персонаж» и «экспорт» жили в localStorage: терялись при смене устройства
-- и не доходили до БД. Персонаж теперь вычисляется из public.characters,
-- экспорт — из profiles.first_export_at (исторических данных нет, копится с 15.07.2026).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS checklist_dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_export_at timestamptz;

-- profiles заблокирован на UPDATE по колонкам (20260702_profiles_lock_privileged_columns.sql).
-- Без явного GRANT новые колонки не запишутся из клиента.
GRANT UPDATE (checklist_dismissed_at, first_export_at) ON public.profiles TO authenticated;

-- Прогресс по шагам онбординга. Не строгая воронка: чеклист не линеен, персонажа
-- можно добавить не написав ни слова — расхождение шагов здесь само по себе сигнал.
CREATE OR REPLACE FUNCTION public.get_admin_activation_funnel()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_email text;
BEGIN
  SELECT value INTO v_admin_email FROM public.app_config WHERE key = 'admin_email';
  IF (auth.jwt() ->> 'email') IS DISTINCT FROM v_admin_email THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  RETURN (
    WITH facts AS (
      SELECT
        p.user_id,
        p.checklist_dismissed_at,
        p.onboarded_at,
        EXISTS (SELECT 1 FROM public.books bk WHERE bk.user_id = p.user_id) AS has_book,
        EXISTS (SELECT 1 FROM public.books bk WHERE bk.user_id = p.user_id AND bk.words > 0) AS has_words,
        EXISTS (SELECT 1 FROM public.characters c WHERE c.user_id = p.user_id) AS has_character,
        p.first_export_at IS NOT NULL AS has_export
      FROM public.profiles p
      WHERE COALESCE(p.is_test, false) = false
    )
    SELECT json_build_object(
      'signed_up',       (SELECT COUNT(*) FROM facts),
      'created_book',    (SELECT COUNT(*) FROM facts WHERE has_book),
      'wrote_words',     (SELECT COUNT(*) FROM facts WHERE has_words),
      'added_character', (SELECT COUNT(*) FROM facts WHERE has_character),
      'tried_export',    (SELECT COUNT(*) FROM facts WHERE has_export),
      'activated',       (SELECT COUNT(*) FROM facts WHERE has_book AND has_words AND has_character AND has_export),
      'dismissed_early', (SELECT COUNT(*) FROM facts WHERE checklist_dismissed_at IS NOT NULL AND onboarded_at IS NULL)
    )
  );
END;
$$;

-- Публичный репозиторий → анон-ключ открыт. Guard внутри + REVOKE снаружи.
REVOKE EXECUTE ON FUNCTION public.get_admin_activation_funnel() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_activation_funnel() TO authenticated;
