-- Платежи, согласия на рекуррент и причины отмен: обезличивание вместо удаления,
-- серверная запись вместо клиентской.
--
-- 1. ON DELETE SET NULL (было CASCADE): при удалении пользователя история платежей
--    (возвраты, сверка с Робокассой, чеки НПД) и факт согласия на рекуррентные
--    списания остаются, теряя только связь с user_id. Решение владельца 2026-10-22.
-- 2. Клиентский INSERT в recurring_consents и cancellation_reasons отозван:
--    согласие пишет create-payment-url (IP из x-forwarded-for, UA, версия текста),
--    причину отмены — cancel-subscription. Обе функции работают под service_role.
-- 3. recurring_consents: inv_id (к какому счёту согласие), consent_version, consent_text.
-- 4. cancellation_reasons: CHECK length(comment) <= 2000 (NOT VALID — старые строки не проверяются).
--
-- ROLLBACK:
--   ALTER TABLE public.payments DROP CONSTRAINT payments_user_id_fkey,
--     ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--   ALTER TABLE public.recurring_consents DROP CONSTRAINT recurring_consents_user_id_fkey,
--     ADD CONSTRAINT recurring_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--   ALTER TABLE public.cancellation_reasons DROP CONSTRAINT cancellation_reasons_user_id_fkey,
--     ADD CONSTRAINT cancellation_reasons_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--   -- NOT NULL вернуть можно только если нет обезличенных строк:
--   ALTER TABLE public.recurring_consents ALTER COLUMN user_id SET NOT NULL;
--   ALTER TABLE public.cancellation_reasons ALTER COLUMN user_id SET NOT NULL;
--   CREATE POLICY "own consents insert" ON public.recurring_consents FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
--   CREATE POLICY "own cancellation insert" ON public.cancellation_reasons FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
--   GRANT INSERT ON public.recurring_consents, public.cancellation_reasons TO authenticated;
--   ALTER TABLE public.cancellation_reasons DROP CONSTRAINT IF EXISTS cancellation_reasons_comment_length;
--   ALTER TABLE public.recurring_consents DROP COLUMN IF EXISTS inv_id, DROP COLUMN IF EXISTS consent_version, DROP COLUMN IF EXISTS consent_text;

-- ─── 1. ON DELETE SET NULL ───────────────────────────────────────────────────
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_user_id_fkey,
  ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.recurring_consents ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.recurring_consents
  DROP CONSTRAINT IF EXISTS recurring_consents_user_id_fkey,
  ADD CONSTRAINT recurring_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.cancellation_reasons ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.cancellation_reasons
  DROP CONSTRAINT IF EXISTS cancellation_reasons_user_id_fkey,
  ADD CONSTRAINT cancellation_reasons_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ─── 2. Клиентская запись отозвана ──────────────────────────────────────────
DROP POLICY IF EXISTS "own consents insert" ON public.recurring_consents;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.recurring_consents FROM anon, authenticated;

DROP POLICY IF EXISTS "own cancellation insert" ON public.cancellation_reasons;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.cancellation_reasons FROM anon, authenticated;

GRANT SELECT, INSERT ON TABLE public.recurring_consents, public.cancellation_reasons TO service_role;

-- ─── 3. Доказательства согласия ──────────────────────────────────────────────
ALTER TABLE public.recurring_consents ADD COLUMN IF NOT EXISTS inv_id          text;
ALTER TABLE public.recurring_consents ADD COLUMN IF NOT EXISTS consent_version text;
ALTER TABLE public.recurring_consents ADD COLUMN IF NOT EXISTS consent_text    text;

CREATE INDEX IF NOT EXISTS idx_recurring_consents_inv_id ON public.recurring_consents (inv_id) WHERE inv_id IS NOT NULL;

-- ─── 4. Лимит длины комментария ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cancellation_reasons_comment_length') THEN
    ALTER TABLE public.cancellation_reasons
      ADD CONSTRAINT cancellation_reasons_comment_length CHECK (comment IS NULL OR length(comment) <= 2000) NOT VALID;
  END IF;
END $$;
