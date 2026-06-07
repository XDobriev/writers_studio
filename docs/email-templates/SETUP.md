# Настройка UniSender Go + Supabase SMTP

Всё что нужно сделать вручную — здесь. Остальное сделает Claude.

---

## Шаг 1 — Создать аккаунт UniSender Go

1. Открыть **go.unisender.ru** → нажать **Регистрация**
2. Зарегистрироваться через email
3. Подтвердить email

> UniSender Go — отдельный продукт от UniSender (unisender.com). Нужен именно **go.unisender.ru** — это транзакционная платформа (API-отправка). UniSender.com — для маркетинговых рассылок.

---

## Шаг 2 — Добавить и верифицировать домен avtorstudio.com

UniSender Go требует подтверждения домена через DNS (SPF + DKIM).

1. В личном кабинете → **Домены** → **Добавить домен**
2. Ввести: `avtorstudio.com`
3. UniSender Go покажет DNS-записи:
   - TXT-запись SPF (`v=spf1 include:... ~all`)
   - CNAME-записи DKIM
4. Зайти в **панель Timeweb** → **Домены** → `avtorstudio.com` → **DNS**
5. Добавить все записи (тип / имя / значение)
6. Вернуться в UniSender Go → нажать **Проверить** (может занять 5–30 минут)
7. Статус должен стать **Подтверждён** ✓

---

## Шаг 3 — Создать API-ключ

1. В личном кабинете → **Настройки** → **API-ключи** → **Создать ключ**
2. Имя: `avtorstudio-supabase`
3. Скопировать ключ — он показывается один раз

---

## Шаг 4 — Настроить Supabase SMTP (5 минут)

UniSender Go поддерживает SMTP-отправку. Supabase использует SMTP для auth-писем (подтверждение, сброс пароля).

### 4а — SMTP

1. Supabase Dashboard → **Project Settings** → **Authentication** → **SMTP Settings**
2. Включить тумблер **Enable Custom SMTP**
3. Заполнить:

| Поле | Значение |
|---|---|
| Host | `smtp.unisender.ru` |
| Port | `465` |
| Username | твой email в UniSender Go |
| Password | твой API-ключ из шага 3 |
| Sender Name | `Авторская студия` |
| Sender Email | `noreply@avtorstudio.com` |

4. Нажать **Save**

### 4б — Шаблоны писем

1. Supabase Dashboard → **Authentication** → **Email Templates**
2. Для каждого из 4 типов — вставить HTML из соответствующего файла этой папки:

| Тип в Supabase | Файл |
|---|---|
| Confirm signup | `confirm-signup.html` |
| Reset password | `reset-password.html` |
| Magic Link | `magic-link.html` |
| Email change | `email-change.html` |

3. Нажать **Save** после каждого

---

## Шаг 5 — Обновить секрет Edge Function

Секрет `RESEND_API_KEY` больше не нужен. Добавить новый:

1. Supabase Dashboard → **Edge Functions** → **Secrets**
2. Добавить: `UNISENDER_API_KEY` = твой API-ключ из шага 3
3. Удалить старый `RESEND_API_KEY` (если был добавлен)

---

## Справочник: SMTP-параметры UniSender Go

| Параметр | Значение |
|---|---|
| SMTP Host | `smtp.unisender.ru` |
| SMTP Port | `465` (SSL) |
| Username | email в UniSender Go |
| Password | API-ключ |
| From Name | `Авторская студия` |
| From Email | `noreply@avtorstudio.com` |

---

## Что изменится после настройки

Supabase будет отправлять письма через UniSender Go вместо дефолтного провайдера.
Все 4 типа писем получат новый дизайн:

- `confirm-signup.html` — подтверждение регистрации
- `reset-password.html` — сброс пароля
- `magic-link.html` — вход по magic link
- `email-change.html` — смена адреса почты

Шаблоны уже готовы в этой папке.
