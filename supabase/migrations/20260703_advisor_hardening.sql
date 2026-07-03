-- Advisor-хардениг 2026-07-03 (Supabase database linter)
--
-- A1: function_search_path_mutable — зафиксировать search_path у SECURITY DEFINER
--     и триггер-функций. Особенно критично для is_admin() (admin-гейт из L11):
--     без фиксированного search_path возможен search-path-hijack.
-- A2: anon/authenticated_security_definer_function_executable — снять EXECUTE
--     у чистых триггер-функций, которые не должны быть доступны через REST RPC
--     (в клиентском коде через .rpc() не вызываются, проверено grep).

-- ── A1: зафиксировать search_path = pg_catalog, public ─────────────────────
-- (не '' — тела функций обращаются к public-таблицам/функциям без схемы;
--  pg_catalog первым исключает подмену встроенных функций, линтер удовлетворён)
ALTER FUNCTION public.is_admin()                 SET search_path = pg_catalog, public;
ALTER FUNCTION public.touch_updated_at()         SET search_path = pg_catalog, public;
ALTER FUNCTION public.strip_html(text)           SET search_path = pg_catalog, public;
ALTER FUNCTION public.compute_synopsis(text)     SET search_path = pg_catalog, public;
ALTER FUNCTION public.trg_chapters_synopsis_fn() SET search_path = pg_catalog, public;
ALTER FUNCTION public.sync_character_chapters(uuid, uuid, text[]) SET search_path = pg_catalog, public;

-- ── A2: REVOKE EXECUTE на триггер-функциях ─────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile()  FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.snapshot_book_on_create()  FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.snapshot_book_words()      FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.recount_book_words()       FROM anon, authenticated, public;
