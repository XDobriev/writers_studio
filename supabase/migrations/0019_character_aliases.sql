ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}';
