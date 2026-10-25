# Настройка Resend + Supabase SMTP

Состояние на 25.10.2026: домен `avtorstudio.com` подтверждён в Resend (регион Ireland, eu-west-1), письма из Edge Functions и auth-письма Supabase идут через Resend.

## Что где настроено

| Что | Где | Значение |
|---|---|---|
| Домен | Resend → Domains | `avtorstudio.com`, Verified |
| DNS (Timeweb Cloud → Домены → DNS) | три записи Resend | TXT `resend._domainkey`, CNAME `send` → `send.forge.rmta.net`, CNAME `rsend` → `rsend-euw1.forge.rmta.net` |
| Ключ для Edge Functions | Resend → API keys, `avtorstudio-edge-functions` (Sending access) | Edge Secrets: `RESEND_API_KEY` |
| Ключ для auth-SMTP | Resend → API keys, `supabase-auth-smtp` (Sending access) | Supabase Auth SMTP, поле Password |
| Отправитель Edge Functions | Edge Secrets `EMAIL_FROM` (необязателен) | по умолчанию `Авторская студия <studio@avtorstudio.com>` |

## Supabase SMTP (auth-письма)

Задаётся в Dashboard → Authentication → Emails → SMTP Settings или Management API (`PATCH /v1/projects/<ref>/config/auth`).

| Поле | Значение |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | API-ключ Resend (`supabase-auth-smtp`) |
| Sender Name | `Авторская студия` |
| Sender Email | `noreply@avtorstudio.com` |

## Шаблоны auth-писем

Authentication → Emails → Templates. Для каждого из 4 типов вставить HTML из файла этой папки:

| Тип в Supabase | Файл |
|---|---|
| Confirm signup | `confirm-signup.html` |
| Reset password | `reset-password.html` |
| Magic Link | `magic-link.html` |
| Email change | `email-change.html` |

Применены ли шаблоны в Dashboard — проверить: письмо сброса пароля 25.10.2026 пришло с темой «Reset Your Password» (дефолт Supabase).

## Ротация ключа

1. Resend → API keys → создать новый ключ (Sending access), старый удалить после замены.
2. Edge Functions: `npx supabase secrets set RESEND_API_KEY=<ключ> --project-ref joaxeoavjvlqmtlepkrr`.
3. Auth-SMTP: обновить Password в SMTP Settings.
