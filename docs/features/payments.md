# Payments

Монетизация через Робокассу. Три плана: Free / Pro (месяц / год) / Lifetime.

## Стек

- **Робокасса** — эквайринг, приём платежей.
- **РобоЧеки СМЗ** — Робокасса-плагин для самозанятых (НПД). Подключён в ЛК Робокассы. Автоматически отправляет чек в приложение «Мой налог» (ФНС) после каждого реального платежа. Ссылка: https://robokassa.com/online-check/robocheck-smz/
- **«Мой налог»** — приложение ФНС, куда попадают чеки после РобоЧеков СМЗ. Не требует ручного ввода доходов.

## Важно про тестовый режим

**РобоЧеки СМЗ обрабатывают только реальные платежи.** Тестовые платежи (`IsTest=1`) не фискализируются — чек в «Мой налог» не появится, email-чек покупателю не придёт. Это штатное поведение Робокассы.

Для проверки фискализации нужен реальный платёж (IsTest=0 в `ROBOKASSA_IS_TEST=false`).

## Edge Functions

### `create-payment-url`
Создаёт URL оплаты. Включает:
- `Receipt` (JSON, URL-encoded) — номенклатура по ФЗ-54 для РобоЧеков СМЗ
- `email` пользователя в Receipt — Робокасса отправит email-чек покупателю
- `tax: 'none'` — без НДС (самозанятый). При переходе на ОСН менять на `'vat20'`
- `ResultUrl2` — для получения `op_key` (нужен при возврате)
- `Shp_plan`, `Shp_user_id` — передаются в вебхук для активации плана

Подпись: `MD5(MerchantLogin:OutSum:InvId:Receipt:ResultUrl2:Password1:Shp_plan=…:Shp_user_id=…)`

> **Receipt в подписи — URL-encoded.** Robokassa требует URL-кодировать `Receipt` *до* включения в строку подписи; одна и та же encoded-строка идёт и в MD5, и в параметр URL ([docs.robokassa.ru/ru/fiscalization](https://docs.robokassa.ru/ru/fiscalization)). То же в `billing-scheduler` (рекуррент). Проверять только реальным платежом — тестовые чеки не фискализируются.

### `robokassa-webhook` (ResultUrl1)
Основной вебхук — активирует план пользователя:
1. Проверяет подпись (Password2 для боевых, TEST_PASSWORD2 для тестовых)
2. Для `lifetime`: декрементирует слоты → обновляет `profiles.plan`
3. Для `pro` / `pro_annual`: выставляет `plan_expires_at`
4. Пишет в `admin_audit_log`
5. Делает upsert в `payments`
6. Fire-and-forget → `payment-confirmation` (email-подтверждение)

**Критично:** `.update().select('user_id')` — без `.select()` supabase-js не видит 0 обновлённых строк и не возвращает ошибку.

### `payment-result2` (ResultUrl2)
Получает JWS-уведомление от Робокассы, сохраняет `op_key` в `payments.op_key`. Нужен для автоматических возвратов (`process-refund`).

### `process-refund`
Возвраты через Робокассу по `op_key`. Требует Bearer-токен (вызывается только из Admin-панели).

> ⚠️ **НЕ соответствует актуальному API Robokassa — требует переписи.** Текущий код бьёт в `services.robokassa.ru/RefundService/Refund/Create` с JWT (Password3) и ждёт `requestId`. Актуальный Operation API ([docs.robokassa.ru/partner-api](https://docs.robokassa.ru/partner-api/MethodDescription/RefundOperation/)): эндпоинт `services.robokassa.ru/PartnerRegisterService/api/Operation/RefundOperation`, авторизация **HTTP Basic** (`Base64(login:password)`, не JWT/Password3), тело JSON `{ RoboxPartnerId, OpKey, RefundSum }`, ответ `{ success, error, resultCode }` (без `requestId` — поллинг `GetState` неприменим).

## Таблицы БД

### `payments`
```
id uuid PK
user_id uuid → auth.users
inv_id text UNIQUE NOT NULL   -- timestamp в мс, генерируется в create-payment-url
op_key text                   -- заполняется из payment-result2
amount numeric(10,2)
plan text
paid_at timestamptz
refunded_at timestamptz
refund_request_id text
```
RLS: пользователь видит только свои строки (SELECT). INSERT/UPDATE через service_role.

### `profiles` (поля плана)
```
plan text           -- 'free' | 'pro' | 'lifetime'
plan_expires_at     -- для pro; null = бессрочно
grandfathered bool  -- грандфазерская скидка (290₽/2900₽ навсегда)
```

## Цены

| План | Обычная | Грандфазерская |
|------|---------|----------------|
| Pro (месяц) | 399 ₽ | 290 ₽ |
| Pro (год)   | 3490 ₽ | 2900 ₽ |
| Lifetime    | 4990 ₽ | — |

Грандфазерский флаг: `profiles.grandfathered = true`. Применяется через Edge Function (проверяет флаг при создании ссылки).

## Secrets (Supabase Edge Functions)

| Ключ | Назначение |
|------|-----------|
| `ROBOKASSA_MERCHANT_LOGIN` | Логин магазина |
| `ROBOKASSA_PASSWORD1` | Пароль #1 (подпись ссылки) |
| `ROBOKASSA_PASSWORD2` | Пароль #2 (проверка вебхука) |
| `ROBOKASSA_TEST_PASSWORD1` | Тестовый Пароль #1 |
| `ROBOKASSA_TEST_PASSWORD2` | Тестовый Пароль #2 |
| `ROBOKASSA_IS_TEST` | `'true'` в тестовом режиме |
| `GRANDFATHERING_ENDS_AT` | ISO-дата окончания грандфазеринга |

## Поток оплаты

```
Пользователь → /offer → кнопка «Купить»
  → create-payment-url (Edge Fn) → URL Робокассы
  → Пользователь оплачивает
  → Робокасса → robokassa-webhook (ResultUrl1) → profiles.plan обновлён
  → Робокасса → payment-result2 (ResultUrl2) → payments.op_key сохранён
  → РобоЧеки СМЗ → «Мой налог» (чек самозанятого, только реальный платёж)
  → Покупатель получает email-чек от Робокассы (только реальный платёж)
  → payment-confirmation (fire-and-forget) → наш email покупателю
```
