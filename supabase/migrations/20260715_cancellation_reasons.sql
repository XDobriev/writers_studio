-- Причина отмены подписки — «самое дешёвое исследование».
--
-- Таблица, а не profiles.cancel_reason: подписку можно отменить, возобновить и отменить
-- снова, и вторая причина затёрла бы первую. История важнее последнего значения.

CREATE TABLE IF NOT EXISTS public.cancellation_reasons (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason     text NOT NULL CHECK (reason IN ('price', 'not_writing', 'missing_features', 'bugs', 'other_tool', 'other')),
  comment    text,
  plan       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cancellation_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own cancellation read" ON public.cancellation_reasons
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "own cancellation insert" ON public.cancellation_reasons
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

GRANT SELECT, INSERT ON TABLE public.cancellation_reasons TO authenticated;

CREATE INDEX IF NOT EXISTS idx_cancellation_reasons_user_id ON public.cancellation_reasons (user_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_reasons_created_at ON public.cancellation_reasons (created_at DESC);

-- Сводка для админки: сколько какой причины + последние комментарии.
CREATE OR REPLACE FUNCTION public.get_admin_cancellations()
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

  RETURN json_build_object(
    'by_reason', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT cr.reason, COUNT(*)::int AS count
        FROM public.cancellation_reasons cr
        JOIN public.profiles p ON p.user_id = cr.user_id
        WHERE COALESCE(p.is_test, false) = false
        GROUP BY cr.reason
        ORDER BY COUNT(*) DESC
      ) t
    ),
    'recent', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT cr.id, cr.reason, cr.comment, cr.plan, cr.created_at, u.email::text
        FROM public.cancellation_reasons cr
        JOIN auth.users u ON u.id = cr.user_id
        JOIN public.profiles p ON p.user_id = cr.user_id
        WHERE COALESCE(p.is_test, false) = false
        ORDER BY cr.created_at DESC
        LIMIT 20
      ) t
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_cancellations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_cancellations() TO authenticated;
