# Robokassa Payment Integration — Design Spec

**Date:** 2026-06-12  
**Status:** Approved

## Overview

Full payment flow: user clicks "Оформить" in SettingsModal → Edge Function generates signed Robokassa URL → user pays on Robokassa → webhook updates `profiles.plan` → `/payment-success` polls until confirmed → navigates to `/books`.

Plans: `pro` (290 ₽, 31 days) and `lifetime` (4990 ₽). No annual plan in initial scope.

---

## Architecture

```
SettingsModal
  → POST /functions/v1/create-payment-url
    Authorization: Bearer <supabase-jwt>
    Body: { plan: "pro" | "lifetime" }
  ← { url: "https://auth.robokassa.ru/Merchant/Index.aspx?..." }
  → window.location.href = url

Robokassa payment page
  → POST Result URL → /functions/v1/robokassa-webhook   (updates profiles.plan)
  → GET  Success URL → https://avtorstudio.com/payment-success?plan=pro&inv_id=…

/payment-success
  → polls useProfile() every 2s via React Query
  → plan !== 'free' → success state → navigate /books
  → timeout 30s    → timeout state  → show manual link to settings
```

---

## Files

| Action | File |
|--------|------|
| CREATE | `supabase/functions/create-payment-url/index.ts` |
| MODIFY | `supabase/functions/robokassa-webhook/index.ts` |
| CREATE | `src/pages/PaymentSuccess.tsx` |
| MODIFY | `src/App.tsx` |
| MODIFY | `src/components/SettingsModal.tsx` |

---

## Edge Function: `create-payment-url`

**Endpoint:** `POST /functions/v1/create-payment-url`  
**Auth:** Supabase JWT via `Authorization: Bearer` header. `user_id` извлекается из токена — клиент не может передать чужой ID.  
**Body:** `{ "plan": "pro" | "lifetime" }`

### Prices

| Plan | OutSum |
|------|--------|
| `pro` | `290.00` |
| `lifetime` | `4990.00` |

### InvId

`Math.floor(Date.now() / 1000) % 2147483647` — timestamp в секундах, уникален при нашем объёме.

### Test mode

Управляется env-переменной `ROBOKASSA_IS_TEST`:
- `"true"` → использует `ROBOKASSA_TEST_PASSWORD1`, добавляет `IsTest=1` в URL
- любое другое значение или отсутствие → боевой режим

Клиент не может включить/отключить тест-режим самостоятельно.

### Signature (Password1)

```
MD5(MerchantLogin:OutSum:InvId:Password1:Shp_plan=<v>:Shp_user_id=<v>)
```

Shp-параметры сортируются **алфавитно** (как в существующем `robokassa-webhook`).

### Result URL (итоговый URL для редиректа)

```
https://auth.robokassa.ru/Merchant/Index.aspx
  ?MerchantLogin=AvtorStudio
  &OutSum=290.00
  &InvId=1234567
  &Description=Подписка Pro — Авторская студия
  &SignatureValue=<md5>
  &IsTest=0
  &Shp_plan=pro
  &Shp_user_id=<uuid>
```

### Required Secrets

| Secret | Описание |
|--------|----------|
| `ROBOKASSA_MERCHANT_LOGIN` | `AvtorStudio` |
| `ROBOKASSA_PASSWORD1` | Пароль #1 из Robokassa ЛК |
| `ROBOKASSA_TEST_PASSWORD1` | Тестовый Пароль #1 |
| `ROBOKASSA_IS_TEST` | `"true"` для тестового режима |

### Response

- `200 { url: string }` — успех
- `400 { error: string }` — неверный план или тело запроса
- `401 { error: string }` — JWT отсутствует или невалиден
- `500 { error: string }` — env не настроен

---

## Edge Function: `robokassa-webhook` (modification)

**Единственное изменение** — выбор Password2 в зависимости от `IsTest`:

```typescript
const isTest = params.get('IsTest') === '1';
const password2 = isTest
  ? Deno.env.get('ROBOKASSA_TEST_PASSWORD2')
  : Deno.env.get('ROBOKASSA_PASSWORD2');
```

Если нужный пароль не установлен — возвращает `ERROR: env not configured` (статус 200, чтобы Robokassa не повторяла запрос бесконечно).

### New Required Secret

| Secret | Описание |
|--------|----------|
| `ROBOKASSA_PASSWORD2` | Пароль #2 из Robokassa ЛК (уже должен быть) |
| `ROBOKASSA_TEST_PASSWORD2` | Тестовый Пароль #2 |

---

## Page: `/payment-success`

**Файл:** `src/pages/PaymentSuccess.tsx`  
**Маршрут:** `/payment-success` — внутри `<AuthGuard>` (пользователь должен быть авторизован).

### URL-параметры

`?plan=pro&inv_id=123` — используются **только для отображения** (заголовок "Активируем подписку Pro..."). Не используются для логики апгрейда.

### Состояния

| Состояние | Условие | UI |
|-----------|---------|-----|
| `checking` | `plan === 'free'`, время < 30с | Спиннер + «Активируем подписку...» |
| `success` | `plan !== 'free'` | Чекмарк + «Добро пожаловать в Pro!» + кнопка «Начать писать» → `/books` |
| `timeout` | 30с прошло, план не изменился | «Платёж получен. Статус обновится в течение минуты.» + кнопка «Открыть настройки» |

### Polling

```typescript
const { data: profile } = useQuery({
  queryKey: QUERY_KEYS.profile(userId),
  queryFn: fetchProfile,
  refetchInterval: (data) => data?.plan === 'free' ? 2000 : false,
});
```

Таймаут реализован через `useEffect` с `setTimeout(30_000)` — при срабатывании переключает в состояние `timeout`.

### Стилизация

Следует дизайн-системе (`design-system.css`). Центрированный контейнер, без сайдбара. Использует `PageMotion` для анимации входа.

---

## Component: `SettingsModal` changes

`UpgradeModal` (lines 30–161): заменить два `<a href="...">` на кнопки.

### Новая логика кнопки

```typescript
async function handlePurchase(plan: 'pro' | 'lifetime') {
  setIsLoading(true);
  try {
    const { data, error } = await supabase.functions.invoke('create-payment-url', {
      body: { plan },
    });
    if (error || !data?.url) throw error ?? new Error('no url');
    window.location.href = data.url;
  } catch (e) {
    setError(e instanceof Error ? e : new Error('Ошибка оплаты'));
  } finally {
    setIsLoading(false);
  }
}
```

Кнопки показывают спиннер во время загрузки (`isLoading`). Ошибка отображается через существующий `useErrorState`.

---

## Robokassa Settings (ручные изменения в ЛК)

| Поле | Текущее значение | Нужное значение |
|------|-----------------|----------------|
| Success URL | `https://avtorstudio.com/` | `https://avtorstudio.com/payment-success` |
| Метод Success URL | POST | **GET** |
| Fail URL | `https://avtorstudio.com/` | оставить |

> **Важно:** метод Success URL должен быть GET — React SPA читает параметры из query string, не из POST-тела.

---

## Supabase Secrets (добавить вручную)

| Secret | Значение |
|--------|---------|
| `ROBOKASSA_MERCHANT_LOGIN` | `AvtorStudio` |
| `ROBOKASSA_PASSWORD1` | Robokassa ЛК → Пароль #1 |
| `ROBOKASSA_PASSWORD2` | Robokassa ЛК → Пароль #2 |
| `ROBOKASSA_TEST_PASSWORD1` | Robokassa ЛК → Тест → Пароль #1 |
| `ROBOKASSA_TEST_PASSWORD2` | Robokassa ЛК → Тест → Пароль #2 |
| `ROBOKASSA_IS_TEST` | `"true"` (первоначально для тестирования) |

---

## Test Plan

1. Установить `ROBOKASSA_IS_TEST=true` в Supabase Secrets
2. Обновить Success URL в Robokassa ЛК → `https://avtorstudio.com/payment-success`, метод GET
3. Нажать «Оформить Pro» в SettingsModal → редирект на Robokassa тест-страницу
4. Провести тестовый платёж (Robokassa предоставляет тестовые карты в документации)
5. Robokassa отправляет webhook → `profiles.plan` = `'pro'`
6. `/payment-success` поллит → обнаруживает изменение → показывает success
7. Перейти в `/books` → SettingsModal показывает Pro-план
8. Убрать `ROBOKASSA_IS_TEST` (или выставить `"false"`) для боевого режима
