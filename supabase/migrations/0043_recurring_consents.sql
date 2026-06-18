-- История согласий пользователей на автоматические рекуррентные списания.
-- Требование Робокассы: сохранять факт и время согласия.

CREATE TABLE IF NOT EXISTS public.recurring_consents (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan       text NOT NULL,
  ip         text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_consents ENABLE ROW LEVEL SECURITY;

-- Пользователь видит только свои записи; записывает только сам себя
CREATE POLICY "own consents read" ON public.recurring_consents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "own consents insert" ON public.recurring_consents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON TABLE public.recurring_consents TO authenticated;

CREATE INDEX idx_recurring_consents_user_id ON public.recurring_consents (user_id);
