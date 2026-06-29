-- Security hardening (review 2026-06-29)
-- H4: GRANT authenticated access before 30.10.2026 deadline
-- M2: REVOKE admin SECURITY DEFINER functions from anon (defense-in-depth)
-- M5: REVOKE character_relationships from anon

-- ═══════════════════════════════════════════════════════════════
-- H4: GRANT TO authenticated — 12 tables that lack explicit GRANT
-- Without this, supabase-js stops seeing them after 30.10.2026.
-- ═══════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.books TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chapters TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.characters TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.character_relations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chapter_characters TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.timeline_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.locations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.writing_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notes TO authenticated;
GRANT SELECT, INSERT, UPDATE    ON TABLE public.chapter_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.location_connections TO authenticated;
GRANT SELECT, INSERT, UPDATE    ON TABLE public.profiles TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- M2: REVOKE admin SECURITY DEFINER RPCs from anon
-- Guards work, but anon should never even reach the function body.
-- ═══════════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION public.get_admin_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_users() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_dau_trend() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_retention() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_anomalies() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_audit_log() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_user_detail(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_revenue() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_user_plan(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.suspend_user(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.extend_plan(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_lifetime_slots(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_feature_flag(text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_user_test(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.append_user_dictionary_word(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_feature_flags() FROM PUBLIC, anon;

-- Ensure authenticated can still call these
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_dau_trend() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_retention() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_anomalies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_audit_log() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_user_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_revenue() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_plan(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.suspend_user(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extend_plan(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_lifetime_slots(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_feature_flag(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_test(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.append_user_dictionary_word(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_feature_flags() TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- M5: REVOKE character_relationships from anon
-- Same fix as map_stamps (0040), missed for this table.
-- ═══════════════════════════════════════════════════════════════

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.character_relationships FROM anon;
