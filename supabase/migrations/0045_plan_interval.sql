ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_interval text NOT NULL DEFAULT 'monthly'
  CHECK (plan_interval IN ('monthly', 'annual'));
