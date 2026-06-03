# Настройка Resend + Supabase SMTP

Всё что нужно сделать вручную — здесь. Остальное сделает Claude.

---

## Шаг 1 — Создать аккаунт Resend

1. Открыть **resend.com** → нажать **Get Started**
2. Зарегистрироваться через GitHub или почту
3. Подтвердить email если попросят

---

## Шаг 2 — Добавить домен avtorstudio.com

> Resend будет отправлять письма с адреса `@avtorstudio.com`,
> поэтому нужно подтвердить владение доменом через DNS.

1. В sidebar Resend нажать **Domains** → **Add Domain**
2. Ввести: `avtorstudio.com`
3. Resend покажет несколько DNS-записей — обычно это:
   - TXT-запись для SPF (`v=spf1 include:amazonses.com ~all`)
   - DKIM (две CNAME-записи)
   - DMARC (одна TXT-запись)
4. Зайти в **панель Timeweb** → раздел **Домены** → `avtorstudio.com` → **DNS**
5. Добавить все записи которые показал Resend (тип / имя / значение)
6. Вернуться в Resend → нажать **Verify** (или подождать 5–30 минут, иногда дольше)
7. Статус должен стать **Verified** ✓

---

## Шаг 3 — Создать API-ключ

1. В sidebar Resend нажать **API Keys** → **Create API Key**
2. Имя: `avtorstudio-supabase`
3. Permission: **Sending access** (Full access тоже подойдёт)
4. Domain: выбрать `avtorstudio.com` (если опция есть)
5. Нажать **Add** → **скопировать ключ** (он показывается только один раз!)

Ключ выглядит примерно так: `re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

## Шаг 4 — Настроить Supabase SMTP (5 минут)

Supabase MCP не поддерживает конфигурацию SMTP — это делается в Dashboard вручную,
но это буквально 5 полей. Claude даст точные значения, ты только вставишь.

### 4а — SMTP

1. Supabase Dashboard → **Project Settings** → **Authentication** → **SMTP Settings**
2. Включить тумблер **Enable Custom SMTP**
3. Заполнить:

| Поле | Значение |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | *(твой API-ключ из шага 3)* |
| Sender Name | `Авторская студия` |
| Sender Email | `hello@avtorstudio.com` |

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

> Всё. На каждый шаблон уходит 30 секунд — открыть файл, выделить всё (Ctrl+A), скопировать, вставить в поле Supabase.

---

## Справочник: SMTP-параметры Resend

Если понадобится ввести вручную:

| Параметр | Значение |
|---|---|
| SMTP Host | `smtp.resend.com` |
| SMTP Port | `465` (SSL) |
| Username | `resend` |
| Password | твой API-ключ |
| From Name | `Авторская студия` |
| From Email | `hello@avtorstudio.com` |

---

## Что изменится после настройки

Supabase будет отправлять письма через Resend вместо дефолтного провайдера.
Все 4 типа писем получат новый дизайн:

- `confirm-signup.html` — подтверждение регистрации
- `reset-password.html` — сброс пароля
- `magic-link.html` — вход по magic link
- `email-change.html` — смена адреса почты

Шаблоны уже готовы в этой папке.
