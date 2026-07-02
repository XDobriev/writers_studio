-- Идемпотентность рекуррентного списания (баг #1: двойное списание при лаге webhook).
-- billing-scheduler отвечает OK на Recurring-запрос, но списание подтверждается
-- АСИНХРОННО через ResultURL (docs.robokassa.ru/ru/recurring-payments: "Ответ OK означает
-- создание операции, но не гарантирует успешное списание"). Пока webhook не продлил
-- plan_expires_at, тот же юзер снова попадает в выборку plan_expires_at <= now()+3д
-- и списывается повторно. last_billed_expiry фиксирует цикл, за который списание уже
-- инициировано: scheduler пропускает юзера, если last_billed_expiry = plan_expires_at.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_billed_expiry timestamptz;

COMMENT ON COLUMN public.profiles.last_billed_expiry IS
  'Значение plan_expires_at, за цикл до которого billing-scheduler уже инициировал рекуррентное списание. Защита от повторного charge при лаге webhook.';
