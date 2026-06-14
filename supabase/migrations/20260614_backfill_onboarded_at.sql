-- Backfill onboarded_at for existing users who already have at least one book.
-- These users were active before the OnboardingChecklist feature was added,
-- so they should not see the checklist on next login.
UPDATE profiles
SET onboarded_at = now()
WHERE onboarded_at IS NULL
  AND id IN (
    SELECT DISTINCT user_id FROM books
  );
