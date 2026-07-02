-- Идемпотентность webhook (баг #3: ретрай ResultURL стекает подписку + двойной decrement слота).
-- Техподдержка Robokassa (02.07.2026): при отсутствии ответа OK{InvId} уведомление
-- повторяется 4 раза с интервалом 1 мин. Если первая доставка успела мутировать профиль,
-- но не вернула OK (таймаут/5xx), повтор читает уже продлённый plan_expires_at и добавляет
-- ещё +31/365д, а для lifetime повторно вызывает decrement_lifetime_slot().
-- confirmed_at — атомарный маркер «этот inv_id уже обработан»: webhook захватывает его
-- одним UPDATE ... WHERE confirmed_at IS NULL и мутирует профиль/слот только при захвате.
-- NULL для строк, пред-созданных billing-scheduler (pending-списание, ещё не подтверждено).
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

COMMENT ON COLUMN public.payments.confirmed_at IS
  'Момент подтверждения платежа webhook''ом. NULL = не подтверждён (pending-строка scheduler''а). Атомарный guard идемпотентности robokassa-webhook.';
