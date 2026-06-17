-- §1.7 Рекуррентные платежи
-- recurring_inv_id: InvId первого Pro-платежа — PreviousInvoiceID для повторных списаний
-- cancel_at_period_end: флаг отмены подписки; billing-scheduler пропускает такого пользователя

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS recurring_inv_id  text,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;

-- Расписание через GitHub Actions (.github/workflows/billing-scheduler.yml)
-- Запускается каждый день в 06:05 UTC, вызывает Edge Function billing-scheduler.
-- pg_cron на этом проекте не активирован.
