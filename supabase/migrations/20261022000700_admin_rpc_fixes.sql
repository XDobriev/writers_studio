-- Admin-RPC:
-- 1. get_admin_activation_funnel / get_admin_cancellations — гейт public.is_admin()
--    вместо сравнения email из JWT с app_config (откат решения L11 в 20260715).
--    get_admin_cancellations: LEFT JOIN — обезличенные (user_id NULL) причины учитываются.
-- 2. get_admin_users — words_total через LATERAL (раньше SUM(b.words) умножался на число снапшотов).
-- 3. get_admin_revenue — MRR по реальным платежам (последний подтверждённый невозвращённый
--    Pro-платёж активного подписчика; годовой /12), churn — по реальным понижениям
--    (subscription_expired / subscription_lapsed / refund_processed / ручной set_plan pro→free).
--    Форма ответа та же (mrr, arr, pro_count, lifetime_count, churn_count_30d, churn_rate)
--    + новое поле cancelling_count.
--
-- ROLLBACK: вернуть определения из .qa/research/2026-10-22/rollback/functions-before.json
--   (get_admin_activation_funnel, get_admin_cancellations, get_admin_users, get_admin_revenue) —
--   сигнатуры не менялись, достаточно CREATE OR REPLACE старым телом.

CREATE OR REPLACE FUNCTION public.get_admin_activation_funnel()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
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

REVOKE ALL ON FUNCTION public.get_admin_activation_funnel() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_activation_funnel() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_cancellations()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  RETURN json_build_object(
    'by_reason', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT cr.reason, COUNT(*)::int AS count
        FROM public.cancellation_reasons cr
        LEFT JOIN public.profiles p ON p.user_id = cr.user_id
        WHERE COALESCE(p.is_test, false) = false
        GROUP BY cr.reason
        ORDER BY COUNT(*) DESC
      ) t
    ),
    'recent', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT cr.id, cr.reason, cr.comment, cr.plan, cr.created_at, u.email::text AS email
        FROM public.cancellation_reasons cr
        LEFT JOIN auth.users u ON u.id = cr.user_id
        LEFT JOIN public.profiles p ON p.user_id = cr.user_id
        WHERE COALESCE(p.is_test, false) = false
        ORDER BY cr.created_at DESC
        LIMIT 20
      ) t
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_cancellations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_cancellations() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS TABLE(id uuid, email text, created_at timestamp with time zone, books_count bigint, words_total bigint, last_active date, plan text, suspended boolean, is_test boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    u.created_at,
    COALESCE(b.books_count, 0)::bigint,
    COALESCE(b.words_total, 0)::bigint,
    ws.last_active,
    COALESCE(p.plan, 'free')::text,
    (u.banned_until IS NOT NULL AND u.banned_until > now()),
    COALESCE(p.is_test, false)
  FROM auth.users u
  LEFT JOIN LATERAL (
    SELECT count(*)::bigint AS books_count, sum(bk.words)::bigint AS words_total
      FROM public.books bk WHERE bk.user_id = u.id
  ) b ON true
  LEFT JOIN LATERAL (
    SELECT max(s.date) AS last_active
      FROM public.writing_snapshots s WHERE s.user_id = u.id
  ) ws ON true
  LEFT JOIN public.profiles p ON p.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_users() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_revenue()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_pro_count        bigint;
  v_lifetime_count   bigint;
  v_cancelling_count bigint;
  v_mrr              numeric;
  v_churn_count      bigint;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  WITH active_pro AS (
    SELECT p.user_id, p.cancel_at_period_end
      FROM public.profiles p
     WHERE p.plan = 'pro'
       AND (p.plan_expires_at IS NULL OR p.plan_expires_at > now())
       AND NOT p.is_test
  ), last_pay AS (
    SELECT DISTINCT ON (pay.user_id) pay.user_id, pay.amount, pay.plan
      FROM public.payments pay
      JOIN active_pro a ON a.user_id = pay.user_id
     WHERE pay.confirmed_at IS NOT NULL
       AND pay.refunded_at IS NULL
       AND pay.plan IN ('pro', 'pro_annual')
     ORDER BY pay.user_id, pay.confirmed_at DESC
  )
  SELECT
    (SELECT count(*) FROM active_pro),
    (SELECT count(*) FROM active_pro WHERE cancel_at_period_end),
    COALESCE((SELECT sum(CASE WHEN lp.plan = 'pro_annual' THEN lp.amount / 12 ELSE lp.amount END) FROM last_pay lp), 0)
  INTO v_pro_count, v_cancelling_count, v_mrr;

  SELECT count(*) INTO v_lifetime_count
    FROM public.profiles WHERE plan = 'lifetime' AND NOT is_test;

  SELECT count(DISTINCT l.target_user_id) INTO v_churn_count
    FROM public.admin_audit_log l
    LEFT JOIN public.profiles p ON p.user_id = l.target_user_id
   WHERE l.created_at >= now() - interval '30 days'
     AND COALESCE(p.is_test, false) = false
     AND (
       l.action IN ('subscription_expired', 'subscription_lapsed')
       OR (l.action = 'refund_processed' AND l.payload ->> 'new_plan' = 'free')
       OR (l.action = 'set_plan' AND l.payload ->> 'old_plan' = 'pro' AND l.payload ->> 'new_plan' = 'free')
     );

  RETURN json_build_object(
    'mrr',              round(v_mrr),
    'arr',              round(v_mrr * 12),
    'pro_count',        v_pro_count,
    'lifetime_count',   v_lifetime_count,
    'cancelling_count', v_cancelling_count,
    'churn_count_30d',  v_churn_count,
    'churn_rate',       CASE
      WHEN (v_pro_count + v_churn_count) > 0
      THEN ROUND((v_churn_count::numeric / (v_pro_count + v_churn_count) * 100), 1)
      ELSE 0
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_revenue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_revenue() TO authenticated;
