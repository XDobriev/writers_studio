-- supabase/migrations/0036_payments.sql
CREATE TABLE public.payments (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  inv_id            text        NOT NULL UNIQUE,
  op_key            text,
  amount            numeric(10,2) NOT NULL DEFAULT 0,
  plan              text        NOT NULL DEFAULT '',
  paid_at           timestamptz NOT NULL DEFAULT now(),
  refunded_at       timestamptz,
  refund_request_id text
);

CREATE INDEX ON public.payments(user_id);
CREATE INDEX ON public.payments(inv_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Пользователь видит только свои платежи (для кнопки возврата)
CREATE POLICY "users see own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT/UPDATE только через service role (Edge Functions)
GRANT SELECT ON public.payments TO authenticated;
