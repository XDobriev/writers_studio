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

## Шаблоны auth-писем и Темы (Subject)

В Dashboard → Authentication → Emails → Templates для каждого типа необходимо задать русскую тему (Subject) и вставить HTML из соответствующего файла этой папки.

> ⚠️ **Важно для антиспама Gmail:** Если тема письма на английском («Reset Your Password»), а тело на русском — Gmail присваивает высокий спам-рейтинг и отправляет письмо в Спам!

| Тип в Supabase | Тема письма (Subject) | Файл шаблона |
|---|---|---|
| Confirm signup | `Подтверждение почты в Авторской студии` | `confirm-signup.html` |
| Reset password | `Сброс пароля в Авторской студии` | `reset-password.html` |
| Magic Link | `Вход в Авторскую студию` | `magic-link.html` |
| Email change | `Подтверждение смены email в Авторской студии` | `email-change.html` |

### Ссылка на сброс пароля (TokenHash vs ConfirmationURL)

- **Рекомендуемый вариант (прямой домен):** `{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}`
  - Генерирует: `https://avtorstudio.com/reset-password?token_hash=...`
  - Домен письма (`avtorstudio.com`) совпадает с доменом ссылки — улучшает спам-рейтинг, нет чужого домена `supabase.co`.
  - Приложение на `/reset-password` автоматически валидирует `token_hash` через `supabase.auth.verifyOtp`.
- **Дефолтный вариант Supabase:** `{{ .ConfirmationURL }}`
  - Генерирует длинную техническую ссылку: `https://<ref>.supabase.co/auth/v1/verify?token=...&type=recovery&redirect_to=https://avtorstudio.com/reset-password`

## Логотип в письме (PNG)

Gmail, Outlook и другие почтовики **не поддерживают SVG** в письмах (блокируют из соображений безопасности).
Для писем используется `https://avtorstudio.com/logo-email.png` (96×96 retina PNG, прозрачный фон).

## Аватарка отправителя в Gmail

В Gmail круглая иконка профиля отправителя не берётся из favicon сайта. Чтобы она появилась:
1. Зарегистрировать бесплатный Google-аккаунт на адрес `noreply@avtorstudio.com` (выбрать «Использовать текущий адрес эл. почты»).
2. Подтвердить код, который придёт на почту домена (в ящик Mail.ru).
3. В профиле созданного Google-аккаунта установить имя «Авторская студия» и загрузить аватар `brand/avatar-dark.png`.
4. После этого все пользователи Gmail будут видеть логотип Авторской студии рядом с письмами от `noreply@avtorstudio.com`.

## Ротация ключа

1. Resend → API keys → создать новый ключ (Sending access), старый удалить после замены.
2. Edge Functions: `npx supabase secrets set RESEND_API_KEY=<ключ> --project-ref joaxeoavjvlqmtlepkrr`.
3. Auth-SMTP: обновить Password в SMTP Settings.
