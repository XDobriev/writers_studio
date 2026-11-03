# Авторизация

Email/пароль, Telegram Login Widget и VK ID используют Supabase Auth. После входа
`usePostAuthRedirect` восстанавливает переход к книгам или ожидающую оплату.

## Telegram и CSP

Официальный iframe-виджет `https://telegram.org/js/telegram-widget.js?22` использует
`data-auth-url`, а не `data-onauth`: обработчик `data-onauth` компилируется через
`eval` и несовместим с production CSP. `unsafe-eval` запрещён и в
`deploy/nginx.conf`, и в `vercel.json`; разрешений `script-src https://telegram.org`
и `frame-src https://oauth.telegram.org` достаточно для redirect-варианта.

1. `useTelegramAuth` создаёт случайный одноразовый `tg_state` в `sessionStorage`
   текущей вкладки и передаёт same-origin `/login?tg_state=…` в `data-auth-url`.
   Параметры `tab` и `plan` сохраняются; ожидающая оплата и согласие на рекуррент
   остаются в прежнем `sessionStorage`. Возврат выполняется в той же вкладке.
   Пока официальный JS создаёт iframe, URL временно содержит тот же state:
   скрипт копирует его в мобильный `return_to`. После загрузки URL восстанавливается.
   `analytics.pageUrl` удаляет `tg_state` из просмотров и referer, в том числе
   при срабатывании SPA-счётчика до загрузки скрипта; Sentry удаляет query целиком.
2. Telegram добавляет `id`, `first_name`, необязательные `last_name`, `username`,
   `photo_url`, `auth_date`, `hash` в query. В `main.tsx`, до мониторинга и Метрики,
   `captureTelegramCallback` удаляет эти поля и state из URL через `replaceState`.
   Callback с отсутствующим/чужим/повторным state, дубликатами или неверными типами
   отклоняется. При недоступном хранилище вход отклоняется; доступен email.
   Мобильный `#tgAuthResult` декодируется и проверяется здесь же, только вместе
   с исходным query-state из `return_to`. Без этого официальный JS мог бы
   автоматически превратить чужой fragment в callback с новым локальным state.
3. Только поля Telegram передаются в `telegram-auth`. Значения query декодируются
   `URLSearchParams` один раз и сохраняются строками, включая пустые строки:
   числовая нормализация, повторное декодирование и включение `plan`/`tg_state`
   в подписываемый payload нарушили бы HMAC.
4. Edge Function проверяет структуру, HMAC-SHA256 с ключом SHA256(bot token) через
   Web Crypto `verify`, возраст `auth_date` ≤15 минут и будущее ≤60 секунд.
   Защита служебного email и совпадение `app_metadata.telegram_id`, а также флаг
   регистрации остаются обязательными. Клиентские поля не подтверждают личность.
5. Edge Function возвращает прежний одноразовый `token_hash`; браузер вызывает
   `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })`. Переход после входа
   ждёт завершения callback, в том числе при восстановленной старой сессии.

Существующая Edge Function принимает строковые `id`/`auth_date` redirect-flow:
формат подписи тот же, миграции БД/новые секреты не нужны. В репозитории общая
валидация вынесена в `_shared/telegramAuth.ts` и строже проверяет форму payload.
Для новых окружений домен сайта должен быть привязан к боту через BotFather.

Проверено 03.11.2026: [официальная документация виджета](https://core.telegram.org/widgets/login-legacy),
[исходный скрипт](https://telegram.org/js/telegram-widget.js?22),
[Supabase verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp).
Новая [Telegram Login / OIDC](https://core.telegram.org/bots/telegram-login)
использует другой протокол и здесь не внедряется.

Проверки: `npm run test` (callback, StrictMode, HMAC, auth_date, типы),
`npx playwright test e2e/telegram-auth.spec.ts` (реальный официальный JS под обоими
CSP; нужен доступ к telegram.org и настроенный `VITE_TELEGRAM_BOT_USERNAME`).
Тест iframe не выполняет вход в личный Telegram-аккаунт. На целевом production-домене
после отдельного разрешённого релиза нужен ручной smoke с настоящим аккаунтом.
