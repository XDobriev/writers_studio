# VK ID Авторизация — Дизайн-спецификация

**Дата:** 2026-06-13  
**Статус:** Утверждён

---

## Цель

Добавить «Войти через VK» на страницу авторизации. VK не является встроенным провайдером Supabase, поэтому используется тот же паттерн, что и для Telegram: Edge Function как посредник между VK API и Supabase Admin API.

---

## Архитектура

```
Auth.tsx
  └─ VK ID SDK (динамический script tag, аналогично Telegram widget)
       └─ OneTap widget → LOGIN_SUCCESS(code, device_id)
            └─ VKID.Auth.exchangeCode(code, device_id) → access_token
                 └─ signInWithVk(access_token, vk_user_id)  ← auth.tsx

auth.tsx
  └─ signInWithVk(access_token, vk_user_id)
       └─ supabase.functions.invoke('vk-auth', { body })
            └─ verifyOtp({ token_hash, type: 'magiclink' })

supabase/functions/vk-auth/index.ts
  1. Принимает { access_token: string, user_id: number }
  2. Верифицирует через GET api.vk.com/method/users.get?access_token=...&v=5.199
  3. Подтверждает: response[0].id === user_id (защита от подмены)
  4. Синтетический email: vk-${vk_id}@vk.local
  5. Ищет пользователя по email (листинг, как в telegram-auth)
  6. admin.createUser или admin.updateUserById с user_metadata
  7. admin.generateLink({ type: 'magiclink', email }) → hashed_token
  8. Возвращает { token_hash, email }
```

---

## Файлы

| Файл | Тип | Описание |
|------|-----|----------|
| `supabase/functions/vk-auth/index.ts` | Новый | Edge Function |
| `src/lib/auth.tsx` | Правка | +`signInWithVk` в контекст |
| `src/pages/Auth.tsx` | Правка | +VK кнопка в блок OAuth-кнопок |

---

## Edge Function: `vk-auth`

### Входные данные
```ts
{ access_token: string; user_id: number }
```

### Верификация токена
```
GET https://api.vk.com/method/users.get
  ?access_token={token}
  &fields=first_name,last_name,photo_100
  &v=5.199
```
Ответ: `{ response: [{ id, first_name, last_name, photo_100 }] }`

Проверка: `response[0].id === user_id`. Если не совпадает — 401.

### User metadata
```ts
{
  vk_id: number,
  first_name: string | null,
  last_name: string | null,
  photo_url: string | null,
  provider: 'vk',
}
```

### Secrets (Supabase Edge Function Secrets)
Секреты не требуются — верификация выполняется через токен самого пользователя.  
`SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` уже доступны автоматически.

---

## Frontend: `auth.tsx`

Добавляется метод `signInWithVk`:

```ts
signInWithVk: (accessToken: string, userId: number) => Promise<{ error: string | null }>
```

Реализация аналогична `signInWithTelegram`:
1. `supabase.functions.invoke('vk-auth', { body: { access_token, user_id } })`
2. Читает `token_hash` из ответа
3. `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })`

---

## Frontend: `Auth.tsx`

### Загрузка SDK
Динамический script tag в `useEffect` (аналогично Telegram):
```
https://unpkg.com/@vkid/sdk@<3.0.0/dist-sdk/umd/index.js
```

### Конфигурация
```ts
VKID.Config.init({
  app: 54634821,
  redirectUrl: 'https://joaxeoavjvlqmtlepkrr.supabase.co/auth/v1/callback',
  responseMode: VKID.ConfigResponseMode.Callback,
  source: VKID.ConfigSource.LOWCODE,
  scope: '',
})
```

`responseMode: Callback` — код приходит в JS-колбек, редирект не происходит.

### Widget
Рендерится `VKID.OneTap` в `div`-контейнере (`vkSlotRef`), поверх — кастомная кнопка-заглушка (как у Telegram). Реальный виджет прозрачен (`opacity: 0`) и кликабелен.

### Состояние
`oauthBusy` расширяется с `'google' | 'telegram' | null` до `'google' | 'telegram' | 'vk' | null`.

### Отображение
Кнопка появляется для обоих табов (Войти / Регистрация), блокируется при `tab === 'signup' && !consent` — как Google и Telegram.

---

## Обработка ошибок

| Сценарий | Поведение |
|----------|-----------|
| VK API недоступен | Edge Function возвращает 502, фронт показывает `setErr` |
| `user_id` не совпадает | Edge Function → 401, фронт — ошибка |
| `access_token` просрочен | VK вернёт ошибку, Edge Function → 401 |
| `generateLink` упал | Edge Function → 500, фронт — ошибка |

Все ошибки через существующий `useErrorState` → `setErr` (не `alert`, не `console.error`).

---

## Что НЕ входит в скоуп

- Получение email от VK (требует специального разрешения VK)
- `secure.checkToken` — более строгая верификация (добавить при необходимости)
- Кнопки «Одноклассники» и «Mail» (предлагал VK, пропускаем)
- `VITE_VK_APP_ID` env var — app_id захардкожен (публичный, не секрет)

---

## Переменные окружения

Новых env vars не требуется. App ID публичный, вписывается напрямую.
