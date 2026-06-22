-- L1 (security hardening, 2026-06-22): убрать инертные write-гранты с клиентских ролей на payments.
-- RLS и так блокирует запись (нет write-политик), но defense-in-depth: клиент не должен
-- иметь INSERT/UPDATE/DELETE. Запись идёт только через service_role (webhook/process-refund/billing-scheduler).
-- SELECT оставляем — RLS ограничивает его строками auth.uid() = user_id.
revoke insert, update, delete, truncate, references, trigger on table public.payments from anon, authenticated;
