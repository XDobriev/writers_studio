-- A3: auth_rls_initplan tail — wrap auth.uid() in a scalar subselect so it is
-- evaluated once per query instead of once per row. Same semantics as ARCH-7
-- applied to the other 10 tables. Verified: performance advisor no longer flags
-- auth_rls_initplan on these tables (2026-07-03).
ALTER POLICY "users see own payments" ON public.payments
  USING ((select auth.uid()) = user_id);

ALTER POLICY "own consents read" ON public.recurring_consents
  USING ((select auth.uid()) = user_id);

ALTER POLICY "own consents insert" ON public.recurring_consents
  WITH CHECK ((select auth.uid()) = user_id);
