# Spec: robokassa-webhook Edge Function

_2026-06-10_

## Цель

Заменить неиспользуемую `yukassa-webhook` на рабочую `robokassa-webhook`, принимающую POST от Robokassa, проверяющую MD5-подпись и активирующей план пользователя.

---

## Scope

**Входит:**
- Создать `supabase/functions/robokassa-webhook/index.ts`
- Удалить `supabase/functions/yukassa-webhook/` (папку целиком)
- Исправить комментарий в `0026_profiles_grandfathered.sql`
- Убрать упоминания ЮKassa из `CLAUDE.md`

**Не входит:**
- Фронтенд (генерация ссылки оплаты — отдельная задача)
- Рекуррентные платежи
- Установка Secrets в Supabase (ручная операция)

---

## Протокол Robokassa (Result URL)

Robokassa присылает POST с `application/x-www-form-urlencoded`:

| Поле | Описание |
|------|----------|
| `OutSum` | Сумма платежа (строка, например `"290.00"`) |
| `InvId` | Номер заказа (целое число) |
| `SignatureValue` | MD5-подпись от Robokassa |
| `Shp_plan` | Кастомный параметр: `pro` / `pro_annual` / `lifetime` |
| `Shp_user_id` | UUID пользователя |

### Формула проверки подписи

```
MD5(OutSum + ":" + InvId + ":" + Password2 + ":" + "Shp_plan=" + Shp_plan + ":" + "Shp_user_id=" + Shp_user_id)
```

Правила:
- shp-параметры в подписи: формат `Name=Value`, разделитель `:`, **сортировка по алфавиту** (`Shp_plan` < `Shp_user_id`)
- Robokassa передаёт `Shp_*` с заглавной `S` и заглавной первой буквой имени
- Сравнение подписей — case-insensitive (Robokassa может вернуть в любом регистре)

### Обязательный ответ

```
OK{InvId}
```

Например: `OK42`. Content-Type: `text/plain`. Если вернуть что-то другое — Robokassa будет повторять запрос каждые N минут.

На любую ошибку (неверная подпись, env не настроен) — всё равно возвращаем `200 OK` с телом `BAD SIGN` или `ERROR`, чтобы не провоцировать ретрай на системные ошибки.

---

## Логика функции

```
1. OPTIONS → CORS preflight
2. POST:
   a. Читаем form-urlencoded тело
   b. Проверяем наличие обязательных полей
   c. Считаем MD5, сравниваем с SignatureValue (toLower обе стороны)
   d. Если неверно → return 200 "BAD SIGN"
   e. Создаём supabase-client с SERVICE_ROLE_KEY
   f. Если plan === 'lifetime':
      - rpc('decrement_lifetime_slot') — атомарно
      - update profiles: plan='lifetime', plan_expires_at=null
   g. Если plan === 'pro' или 'pro_annual':
      - daysToAdd = plan==='pro_annual' ? 365 : 31
      - expiresAt = now + daysToAdd
      - Если GRANDFATHERING_ENDS_AT задан и now < ends_at → grandfathered=true
      - update profiles: plan='pro', plan_expires_at=expiresAt, [grandfathered=true]
   h. insert admin_audit_log: action='payment_received', payload={amount, plan, inv_id}
   i. fire-and-forget: fetch payment-confirmation (не await результат, ошибку logируем)
   j. return 200 text/plain "OK{InvId}"
```

---

## Secrets (устанавливать вручную в Supabase Dashboard)

| Secret | Обязателен |
|--------|-----------|
| `ROBOKASSA_MERCHANT_LOGIN` | Да |
| `ROBOKASSA_PASSWORD2` | Да |
| `GRANDFATHERING_ENDS_AT` | Нет (ISO-дата) |
| `SUPABASE_URL` | Авто (Supabase) |
| `SUPABASE_SERVICE_ROLE_KEY` | Авто (Supabase) |

Для `payment-confirmation` нужны отдельно: `UNISENDER_API_KEY`, `EMAIL_FROM`.

---

## Удаление ЮKassa

- `supabase/functions/yukassa-webhook/index.ts` → удалить папку
- `supabase/migrations/0026_profiles_grandfathered.sql` строка 2: `yukassa-webhook` → `robokassa-webhook`
- `CLAUDE.md`: убрать раздел `supabase/functions/yukassa-webhook` из архитектуры
