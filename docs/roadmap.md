# Roadmap — Авторская студия

_Обновлён: 2026-06-13_ — Виртуализация CharacterGrid: @tanstack/react-virtual, row-based virtualizer, ResizeObserver для динамических колонок, Framer Motion убран с уровня элементов. Ранее: cursor-based пагинация персонажей (useInfiniteQuery + IntersectionObserver), PersistQueryClientProvider dehydrateOptions, Export dynamic imports DOCX/EPUB (490 KB → 25 KB), 7 FK-индексов в Supabase. Идентифицирован: RLS auth_rls_initplan на 10 таблицах.

**Сейчас:** _(не задана — заполнить в начале сессии)_

---

## Технический долг — масштабирование

> Отсортировано по значимости. Первые два блокируют нормальную работу при росте данных.

---


### ARCH-3. Оптимизация crossrefs.ts — N+1 при синхронизации персонажей

**Проблема:** `syncCharacterAcrossAllChapters` в [src/lib/crossrefs.ts](src/lib/crossrefs.ts) делает три сетевых раунда для каждого вызова:
1. `SELECT id, content FROM chapters WHERE book_id = ?` — загружает весь контент всех глав
2. `UPSERT` в `chapter_characters` для найденных глав
3. `DELETE` из `chapter_characters` для не-найденных глав

Для книги с 50 главами по 5000 слов каждая — запрос тянет ~500 КБ текста только чтобы прогнать regexp. Вызывается при каждом сохранении персонажа с псевдонимами.

**Когда критично:** при 30+ главах или частом сохранении персонажей. Сейчас терпимо, но с ростом книг станет ощутимым.

**Решение:** перенести regexp-поиск на уровень PostgreSQL через RPC-функцию. PostgreSQL `regexp_matches` + `tsvector` (если добавить FTS-индекс на `chapters.content`) сделает поиск за один запрос на стороне сервера без передачи контента по сети.

**Шаги реализации:**
1. Миграция: создать SQL-функцию `sync_character_chapters(character_id uuid, book_id uuid, aliases text[])` которая делает всё в одном atomic блоке: regexp-поиск по `chapters.content`, upsert/delete в `chapter_characters`
2. В `src/lib/crossrefs.ts` — заменить `syncCharacterAcrossAllChapters` на вызов RPC: `supabase.rpc('sync_character_chapters', { character_id, book_id, aliases })`
3. Аналогично рассмотреть `findNameVariantsInText` — тоже тянет весь контент глав

**Файлы:** `supabase/migrations/` (новая функция), `src/lib/crossrefs.ts`
**Проверить:** сохранение персонажа с 3 псевдонимами в книге из 40 глав → вкладка Network показывает 1 запрос вместо 3; главы корректно определяются в `chapter_characters`

---

### ARCH-4. Performance instrumentation — нет метрик Supabase-запросов

**Проблема:** нет никакого инструмента для измерения производительности запросов к Supabase в продакшене. Невозможно объективно понять, какой запрос тормозит и насколько помогает оптимизация. Единственный `performance.now()` — самодельный, только на лендинге.

**Sentry уже подключён** (`@sentry/react` в `src/main.tsx`) — достаточно добавить инструментирование в существующий код.

**Решение:**
1. В `src/lib/repository.ts` обернуть все методы в timing-wrapper с `Sentry.metrics.distribution` (или `performance.measure`) — одно место, покрывает все таблицы автоматически
2. Добавить трассировку для `listChapters`, `listCharacters`, `syncCharacterAcrossAllChapters` — три самых тяжёлых запроса
3. Опционально: Playwright E2E assertion на время загрузки страницы Characters (`expect(duration).toBeLessThan(2000)`)

**Шаги реализации:**
1. В `createRepository` (repository.ts) — обернуть `list/create/update/delete` в `performance.mark` + `performance.measure`, отправлять в Sentry через `Sentry.addBreadcrumb` или `Sentry.metrics`
2. В `src/lib/characters.ts` — аналогично для `listCharacters`
3. Проверить что метрики появляются в Sentry Dashboard → Performance

**Файлы:** `src/lib/repository.ts`, `src/lib/characters.ts`
**Проверить:** открыть Characters → Sentry → Performance → появились spans `db.characters.list` с временем выполнения

---

### ARCH-5. Разбивка монолитных компонентов

**Проблема:** три компонента значительно превышают порог читаемости:

| Файл | Строк | Встроенных компонентов |
|---|---|---|
| `src/pages/Timeline.tsx` | ~1221 | 5–6 |
| `src/pages/Characters.tsx` | ~1192 | 6–7 (`HeroBlock` ~287 стр, `RelationsBlock` ~150 стр) |
| `src/pages/Landing.tsx` | ~1044 | 3–4 секционных блока |

Такой размер делает git diff нечитаемым, усложняет навигацию, увеличивает вероятность конфликтов и мешает извлечению логики в хуки.

**Решение:** поэтапное выделение sub-компонентов в отдельные файлы без изменения поведения.

**Порядок (от наибольшей связности к наименьшей):**
1. `Characters.tsx` → выделить `HeroBlock.tsx`, `RelationsBlock.tsx`, `ChaptersTab.tsx` в `src/components/` (или `src/pages/Characters/`)
2. `Timeline.tsx` → выделить `TimelineEventCard.tsx`, `TimelineFilters.tsx`
3. `Landing.tsx` → выделить секционные блоки (FeaturesSection, ProcessSection, PricingSection)

**Критерий готовности:** ни один файл в `src/pages/` и `src/components/` не превышает 400 строк.

**Файлы:** `src/pages/Characters.tsx`, `src/pages/Timeline.tsx`, `src/pages/Landing.tsx`, новые файлы в `src/components/`
**Проверить:** typecheck чистый; визуально страницы не изменились; git diff следующего коммита читаем

---

### ARCH-6. Тесты для критического кода — repository.ts и queries.ts не покрыты

**Проблема:** самые важные части data layer (`repository.ts`, `queries.ts`) не имеют unit-тестов. Изменение `createRepository` или `QUERY_KEYS` может сломать весь data layer без видимого сигнала до E2E.

**Что покрыть в первую очередь:**
- `repository.ts` — `list` с лимитом, обработка ошибок → `DbError`, `create` с дефолтами
- `queries.ts` — стабильность ключей `QUERY_KEYS` (регрессия при переименовании)
- `crossrefs.ts` — `extractCharacterMentions` для кириллических имён с lookaround (особенно баг с `\b` для кириллицы)

**Шаги реализации:**
1. Создать `src/lib/__tests__/repository.test.ts` — мокировать `supabase` через `vi.mock('../supabase')`
2. Создать `src/lib/__tests__/crossrefs.test.ts` — юнит-тесты `extractCharacterMentions` без моков (чистая функция)
3. Создать `src/lib/__tests__/queries.test.ts` — проверить стабильность ключей `QUERY_KEYS`

**Файлы:** `src/lib/__tests__/repository.test.ts` (новый), `src/lib/__tests__/crossrefs.test.ts` (новый), `src/lib/__tests__/queries.test.ts` (новый)
**Проверить:** `npm test` → все три файла зелёные; `extractCharacterMentions('Анна', ['Аня'])` → верно для кириллицы

---

### ARCH-7. RLS initplan — `auth.uid()` re-evaluates per-row

**Проблема:** Supabase advisors зафиксировали `auth_rls_initplan` на **10 таблицах**: `books`, `chapters`, `characters`, `character_relations`, `chapter_characters`, `timeline_events`, `locations`, `notes`, `profiles`, `writing_snapshots`. Все политики используют `auth.uid()` напрямую — Postgres вычисляет его заново для каждой строки вместо одного вычисления на запрос. На таблицах с большим числом строк это full-scan × cost-per-row.

**Когда критично:** при 1 000+ строк на `book_id` (главы большого проекта, timeline с событиями). Сейчас незаметно; становится ощутимым при росте данных.

**Решение:** заменить `auth.uid()` на `(select auth.uid())` во всех `WHERE`/`USING` условиях RLS. PostgreSQL превращает его в initplan — вычисляется один раз на весь запрос.

**Шаги реализации:**
1. Для каждой из 10 таблиц: `ALTER POLICY ... USING ((select auth.uid()) = user_id)`
2. Применить через Supabase MCP одной миграцией
3. Проверить через `EXPLAIN (ANALYZE, FORMAT JSON)` что initplan стал `Result` а не повторным вызовом

**Файлы:** `supabase/migrations/` (новая миграция `fix_rls_initplan.sql`)
**Проверить:** `EXPLAIN SELECT * FROM characters WHERE book_id = '...'` — `InitPlan` со статическим результатом; `Rows Removed by RLS` не растёт пропорционально числу строк

---

## Активные баги

> Самый критичный — первый в списке.

> **Шаблон новой записи:**
> ```
> ### Краткое название
> **Симптом:** [что видит пользователь]
> **Воспроизвести:** 1. … → 2. … → 3. ожидаю X, вижу Y
> **Файлы:** src/components/...
> **Проверить:** [минимальный шаг верификации фикса]
> ```

---

## Задачи — от критичного к некритичному

---


### 1. Email-механика — продумать полную карту писем

**Что это:** сейчас нет ясности какие письма отправляются, когда и зачем. Нужно зафиксировать все события → письма до начала реализации.

**Что продумать:**
1. **Transactional** (triggered by action): подтверждение email (если включим), сброс пароля, смена email, подтверждение оплаты
2. **Welcome-письмо** после регистрации: что пишем новому пользователю, когда отправляем (сразу / через 5 мин?), какой CTA
3. **Онбординг-цепочка** (7 писем, blueprint → `docs/email-onboarding.md`): реализовывать после Робокасса
4. **Триггерные события**: первая книга создана, первая глава написана, неактивность 7 дней, план истёк
5. **От кого** приходят письма: имя отправителя, адрес, reply-to

**Результат:** таблица `событие → письмо → задержка → CTA` в `docs/email-onboarding.md` или отдельный `docs/email-map.md`.

**Связано:** `docs/email-onboarding.md` (онбординг-цепочка уже расписана).

> ⚠️ **При реализации онбординга:** в `Auth.tsx` уже есть state `consentMarketing` (необязательный чекбокс «Согласен получать письма»). Перед отправкой писем 2–7 — сохранить значение в `profiles` (новая колонка `marketing_consent boolean default false`), читать при формировании очереди рассылки. Без флага — отправлять только письмо 1 (приветствие, транзакционное).

---



### 2. Уведомление Роскомнадзора перед публичным запуском ⚠️

**Что это:** по закону ФЗ-152 любой сайт, собирающий данные пользователей (email, имя), обязан зарегистрироваться как оператор персональных данных. Штраф для физлица/самозанятого — 5 000–10 000 ₽ за неуведомление; до 50 000 ₽ за обработку без согласия.

**Что сделать:** зайти на pd.rkn.gov.ru, заполнить форму (~30 минут). Указать: оператор — физлицо (ФИО, ИНН), статус — самозанятый, цель обработки — регистрация и авторизация пользователей, категории данных — email.

**Файлы:** нет (ручное действие на pd.rkn.gov.ru)
**Проверить:** скриншот/email подтверждения от РКН

---

### 3. Перенос Supabase на VPS — локализация данных (ФЗ-242) ⚠️

**Что это:** с 01.07.2025 первичный сбор и хранение ПД граждан РФ обязан происходить на серверах в России (ФЗ-152, ст. 18.1). Supabase Cloud на AWS eu-central-1 (Франкфурт) — нарушение. Штраф для физлица до 50 000 ₽ + РКН вправе заблокировать сайт независимо от суммы штрафа.

**Решение:** self-hosted Supabase на Timeweb VPS (Ubuntu 24.04, уже оплачен). Данные физически в РФ — нарушения нет.

**Когда делать:** при ~50 платящих пользователях или когда Supabase Cloud free tier начнёт кончаться (500 МБ база или 50k MAU) — что наступит раньше. До этого риск РКН для стартапа с малым числом пользователей практически нулевой; апгрейд VPS + время на настройку не окупаются раньше.

**Требования к VPS перед началом:** минимум 4 ГБ RAM (рекомендуется 8 ГБ) и 20 ГБ свободного диска. Проверить: `free -h` и `df -h /`. Если меньше — апгрейдить тариф на Timeweb.

**План нулевого даунтайма:**
1. Установить Docker на VPS: `curl -fsSL https://get.docker.com | sh`
2. Скачать Supabase Docker: `git clone --depth 1 --filter=blob:none --sparse https://github.com/supabase/supabase && cd supabase && git sparse-checkout set docker`
3. Сгенерировать секреты: `sh utils/generate-keys.sh` — **использовать тот же `JWT_SECRET` что в Supabase Cloud** (Dashboard → Settings → API) — иначе все активные сессии пользователей инвалидируются
4. Настроить `.env`: `SUPABASE_PUBLIC_URL=https://avtorstudio.com/sb`, поднять контейнеры на `127.0.0.1:8000` (не на публичный интерфейс)
5. Экспортировать только схему `public` из Cloud: `pg_dump --schema=public --no-privileges --no-owner`
6. Импортировать в self-hosted через `docker exec`
7. Запустить оба варианта параллельно (Cloud продолжает работать)
8. Переключить nginx `proxy_pass /sb/` с Cloud URL на `http://127.0.0.1:8000` → `nginx -s reload` (~0.5 сек переключения, пользователи не почувствуют)
9. Мониторить 24–48 часов → отключить Cloud через неделю
10. Обновить `VITE_SUPABASE_ANON_KEY` в Vercel и `.env` на новый сгенерированный ключ
11. Обновить `site_url` / OAuth redirect URLs (Google, Telegram) в self-hosted дашборде
12. Обновить `Privacy.tsx` раздел 4: убрать «ведём работу по переносу», написать «данные хранятся на серверах в РФ»

**Инструмент управления:** использовать Portainer (GUI для Docker, есть в маркетплейсе Timeweb) вместо CLI — проще для первого раза.

**Файлы:** `~/supabase-project/docker-compose.yml` (создать на VPS), `~/supabase-project/.env` (создать на VPS), `/etc/nginx/sites-available/avtorstudio.com` (обновить proxy_pass), `src/pages/Privacy.tsx` (раздел 4), Vercel env vars (`VITE_SUPABASE_ANON_KEY`)
**Проверить:** `docker compose ps` → все `healthy` → зайти в приложение → авторизация через email работает → Edge Functions отвечают → `SELECT version()` на self-hosted instance

---

### 4. GEO — внешние упоминания (постоянно после запуска)

**Что это:** AI в 6.5× чаще цитирует сторонние источники, чем сам сайт. Машиночитаемые файлы (`llms.txt`, `pricing.md`) и FAQ-блок ✅ готовы. Остался самый мощный рычаг — присутствие на внешних площадках.

**Площадки:**
- Статья на **vc.ru** или **Habr** — «Как я строю редактор для писателей» (dev-journey)
- **ProductHunt** — запуск во время публичного выхода
- **Reddit** r/worldbuilding, r/writing — отвечать на вопросы, упоминать инструмент
- Писательские форумы и **Яндекс.Дзен** — для русскоязычной аудитории

**Проверить:** спросить ChatGPT/Perplexity «онлайн-редактор для писателей на русском языке» — появляется ли avtorstudio.com

---

### 5. Robokassa — платёжный провайдер

**Что это:** без платёжной системы нет монетизации. Robokassa: поддерживает самозанятых, рекуррентные платежи и **автоматически формирует чеки** через РобоЧеки СМЗ (интеграция с «Мой налог»). Комиссия 3,9% (от 100к/мес — 3,4%).

**Как работает интеграция:**
- Первый платёж: редирект пользователя на Robokassa → он вводит карту → Robokassa шлёт POST на **Result URL** → проверяем MD5-подпись → возвращаем `OK{InvId}` → активируем план
- Рекуррентные: планировщик раз в месяц дёргает Robokassa API с `PreviousInvoiceID` — списание без участия пользователя
- Подпись создания: `MD5(MerchantLogin:OutSum:InvId:Password1:Shp_plan=v:Shp_user_id=v)`
- Подпись вебхука: `MD5(OutSum:InvId:Password2:Shp_plan=v:Shp_user_id=v)` (shp по алфавиту, без MerchantLogin)
- Чеки: автоматически через РобоЧеки СМЗ — подключены

**Что уже сделано:**
- ✅ Магазин `AvtorStudio` зарегистрирован и активен, алгоритм MD5
- ✅ РобоЧеки СМЗ подключены (зелёная точка) — чеки в ФНС автоматически
- ✅ Боевые Пароль #1 и #2 сгенерированы; тестовые #1 и #2 сгенерированы (ротированы 2026-06-13)
- ✅ Result URL → `https://joaxeoavjvlqmtlepkrr.supabase.co/functions/v1/robokassa-webhook`, метод POST
- ✅ `supabase/functions/robokassa-webhook/index.ts` — реализован, задеплоен (v14): MD5 timing-safe, pro/pro_annual/lifetime, грандфазеринг, audit_log, fire-and-forget email; `.trim()` на паролях
- ✅ `supabase/functions/create-payment-url/index.ts` — реализован, задеплоен (v10): формирует подписанную ссылку, поддерживает IsTest
- ✅ `supabase/functions/payment-confirmation/index.ts` — письмо покупателю через UniSender Go (готов)
- ✅ `app_settings.lifetime_slots_remaining = 50` + атомарный RPC `decrement_lifetime_slot()` (миграция 0025)
- ✅ `profiles.grandfathered boolean` (миграция 0026)
- ✅ Лендинг и UpgradeModal показывают живой счётчик Lifetime-слотов
- ✅ В настройках у грандфазированных: «✦ Ранняя цена · 290 ₽/мес навсегда»
- ✅ Все Secrets заданы в Supabase Vault: `ROBOKASSA_MERCHANT_LOGIN`, `PASSWORD1/2`, `TEST_PASSWORD1/2`, `ROBOKASSA_IS_TEST=true`
- ✅ `src/components/SettingsModal.tsx` — кнопки «Оформить» подключены к `create-payment-url`; страница `/payment-success` с поллингом
- ✅ E2E тестовый платёж Pro пройден (IsTest=1): `profiles.plan = 'pro'` обновился, страница `/payment-success` показала успех

**Что осталось:**
1. **Переключить на боевой режим:** изменить `ROBOKASSA_IS_TEST` с `true` на `false` в Supabase Vault
2. **Тестовый боевой платёж 1 ₽** — убедиться что подпись, webhook и `profiles.plan` работают в продакшене
3. **Проверить возвраты** — через Robokassa ЛК (ручной возврат) убедиться что средства возвращаются
4. **E2E Lifetime** — тестовый платёж с `plan=lifetime` → `lifetime_slots_remaining` убывает → `profiles.plan = 'lifetime'`

**Рекуррентные — отдельная фаза после первых платежей:**
- Сохранять `InvId` первого платежа → продление через Robokassa Recurring API с `PreviousInvoiceID`
- Sandbox для рекуррентных недоступен — тестировать на реальных суммах (1 ₽)

**При переносе на self-hosted:** обновить Result URL в Robokassa ЛК; переложить Secrets в docker-compose `.env`; задеплоить функции через Supabase CLI.

**Файлы:** `supabase/functions/robokassa-webhook/index.ts`, `supabase/functions/create-payment-url/index.ts` (создать), `src/components/SettingsModal.tsx`
**Проверить:** тестовый платёж → `profiles.plan = 'pro'` → SettingsModal показывает Pro; Lifetime → `lifetime_slots_remaining` убывает; чек на email
**Deps:** Оферта (`src/pages/Offer.tsx`) — ✅ готово

---

### 6. Отмена подписки

**Что это:** механизм самостоятельной отмены Pro-подписки без участия поддержки. Сейчас — `mailto:`-ссылка, нужна полноценная in-app отмена.

**Ключевые решения:**
- Добавить колонку `cancel_at_period_end boolean default false` в `profiles`
- При нажатии «Отменить подписку» → подтверждение → `cancel_at_period_end = true` (доступ сохраняется до `plan_expires_at`)
- Планировщик рекуррентных платежей (§4) проверяет флаг — если `true`, не выставляет следующий счёт, а сбрасывает `plan = 'free'` и `cancel_at_period_end = false` после истечения
- В настройках вместо «Активна до ...» показывать баннер: «Отменена · доступ до [дата]» + кнопка «Возобновить»

**Что продумать до реализации:**
- Нужен ли exit-опрос при отмене (1 вопрос: причина) → сохранять в `profiles.cancel_reason text`
- Нужен ли экран удержания (discount offer) перед подтверждением отмены
- Email-уведомление при отмене (transactional через UniSender Go)

**Файлы:** `supabase/migrations/` (колонка `cancel_at_period_end`), `src/components/SettingsModal.tsx` (таб «Подписка»), `supabase/functions/robokassa-webhook/` (планировщик рекуррентных)
**Проверить:** Pro-пользователь → «Отменить» → подтверждение → баннер «доступ до [дата]»; после `plan_expires_at` → `plan = 'free'`; кнопка «Возобновить» сбрасывает флаг
**Deps:** §5 (Robokassa, рекуррентные платежи)

---

### 7. Соавторство — приглашение редактора

**Что это:** владелец книги может пригласить другого пользователя редактировать. Нужна таблица `book_collaborators` с ролями `editor | viewer`.

**Что сделать:** миграция — таблица `book_collaborators (book_id, user_id, role, invited_by, created_at)`. Владелец вводит email → создаётся pending-запись → пользователь получает email с ссылкой → принимает приглашение. RLS: `auth.uid() = user_id OR EXISTS (SELECT 1 FROM book_collaborators WHERE book_id = ... AND user_id = auth.uid())`.

**Файлы:** `supabase/migrations/` (таблица `book_collaborators`), `src/App.tsx` (маршрут принятия приглашения), `src/components/SettingsModal.tsx` или новый `CollaboratorsPanel`
**Проверить:** владелец приглашает email → приглашённый видит книгу в Dashboard с ролью `editor` → RLS блокирует удаление книги не-владельцем

---



### 8. Ручное тестирование перед публичным запуском

**Что это:** полный прогон критических пользовательских сценариев перед первым публичным запуском. ~1–2 часа. Аккаунт для тестирования: `e2e@avtorskaya-studiya.vercel.app`.

#### Критично — блокирует запуск

| # | Сценарий | Ожидаемый результат |
|---|---|---|
| 1 | Регистрация нового пользователя | Письма нет (confirm отключён), сразу попадает в Home |
| 2 | Повторный вход | Сессия восстанавливается без ошибки |
| 3 | Выход из аккаунта | Редирект на Landing, `/books/*` заблокирован |
| 4 | Создать книгу → создать главу → напечатать текст → подождать 3 сек → обновить страницу | Текст сохранился |
| 5 | Split-режим на 375px | ✅ Редирект на Editor (split недоступен на мобильном) |
| 6 | Robokassa тестовый платёж → webhook | `profiles.plan` обновился в SettingsModal (когда §4 будет реализован) |

#### Важно — исправить до первых 100 пользователей

| # | Сценарий | Ожидаемый результат |
|---|---|---|
| 7 | Создать персонажа с аватаром | Аватар виден в grid и hover-карточке в редакторе |
| 8 | Связь между персонажами: создать → удалить | Видна в Characters, удаляется без ошибки |
| 9 | Экспорт DOCX или FB2 | Файл скачивается и открывается |
| 10 | Экспорт пустой книги | Не крашится |
| 11 | Хронология / Заметки / Карта: создать → обновить → удалить | Happy path каждой страницы |
| 12 | Модалки (настройки, версии, подтверждения) на 375px | Не выходят за экран, кнопки доступны |

**Файлы:** все страницы и компоненты приложения  
**Проверить:** все 12 пунктов выше без ошибок в консоли

> 🛠 **Скиллы:** `gstack` — для автоматизации части сценариев через headless-браузер; `systematic-debugging` — при обнаружении багов.

---



### 9. VK OAuth — авторизация через ВКонтакте

**Что это:** альтернативный способ входа для российских пользователей, которые не используют Google. ВКонтакте — основная площадка писательских сообществ в РФ.

**Контекст:** Google регулятивно нестабилен в РФ и периодически throttled РКН. Email + Telegram покрывают ~90% аудитории; VK добавит покрытие писательской ниши. **Supabase НЕ поддерживает VK как встроенный провайдер** (`provider: 'vk'` не существует в supabase-js). Реализация — через Edge Function по образцу `telegram-auth`.

---

#### Технические детали (исследовано 2026-06-11)

VK ID использует **OAuth 2.1 + PKCE** (не старый `oauth.vk.com`). Документация: [id.vk.com/about/business/go/docs](https://id.vk.com/about/business/go/docs/ru/vkid/latest/vk-id/intro/plan)

**Эндпоинты VK ID:**

| Шаг | URL | Метод |
|---|---|---|
| Авторизация | `https://id.vk.com/authorize` | GET (редирект) |
| Обмен кода на токен | `https://id.vk.com/oauth2/auth` | POST form-urlencoded |
| Данные пользователя | `https://id.vk.ru/oauth2/user_info` | GET, `Authorization: Bearer` |

**Параметры авторизационного URL:**
```
https://id.vk.com/authorize
  ?response_type=code
  &client_id=APP_ID
  &redirect_uri=https://avtorstudio.com/login
  &scope=vkid.personal_info%20email
  &state=RANDOM_NONCE
  &code_challenge=BASE64URL(SHA256(code_verifier))
  &code_challenge_method=S256
```

**Параметры token exchange (POST body):**
```
grant_type=authorization_code
&client_id=APP_ID
&code=AUTHORIZATION_CODE
&redirect_uri=https://avtorstudio.com/login
&device_id=DEVICE_ID        ← приходит вместе с code в redirect URL
&code_verifier=CODE_VERIFIER
```
> ⚠️ `client_secret` не нужен — PKCE заменяет его. `device_id` — обязательный параметр, без него token exchange завалится.

**Token response:**
```json
{ "access_token": "vk2.a.WYs8...", "expires_in": 3600, "refresh_token": "vk2.a.zYe8...", "user_id": 123456789 }
```

**UserInfo response** (`GET https://id.vk.ru/oauth2/user_info`, `Authorization: Bearer ACCESS_TOKEN`):
```json
{ "user": { "user_id": "123456789", "first_name": "Иван", "last_name": "Иванов", "email": "user@example.com", "avatar": "https://sun9-xxx.userapi.com/..." } }
```
> Email возвращается только если `scope=email` и у пользователя есть подтверждённый email — не гарантирован. Нужна стратегия фолбэка при создании аккаунта без email.

---

#### Почему Custom Supabase OAuth Provider не подходит

Supabase Custom Provider не умеет передавать `device_id` при обмене кода — он приходит вместе с `code` в redirect URL, но Supabase его игнорирует. Без `device_id` VK ID отклонит token exchange.

---

#### Схема реализации (Edge Function)

```
Браузер → генерирует code_verifier/challenge → редирект на id.vk.com/authorize
         ← ?code=X&device_id=Y&state=Z в redirect URI
Браузер → POST /functions/v1/vk-auth { code, device_id, code_verifier }
         → Edge Function: POST id.vk.com/oauth2/auth → access_token
         → Edge Function: GET id.vk.ru/oauth2/user_info → { user }
         → Edge Function: supabase.auth.admin.createUser / getUserByEmail
         → возвращает token_hash
Браузер: supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }) → сессия
```

PKCE-пара генерируется на **фронтенде** (или в Edge Function), `code_verifier` передаётся вместе с `code` в Edge Function при обратном вызове.

---

#### Что нужно сделать

**Шаг 0 — Создать VK ID приложение:**
1. Зайти на [id.vk.com/about/business/go](https://id.vk.com/about/business/go/) → «Подключить»
2. Тип: **Веб-сайт**
3. Redirect URI: `https://avtorstudio.com/login`
4. Получить **App ID** (= client_id) — клиентский секрет не нужен

**Шаг 1 — Edge Function** `supabase/functions/vk-auth/index.ts`:
- Принимает `{ code, device_id, code_verifier }`
- POST на `id.vk.com/oauth2/auth` → токен
- GET на `id.vk.ru/oauth2/user_info` → профиль
- `supabase.auth.admin.getUserById` / `createUser` → `token_hash`
- Возвращает `{ token_hash }`

**Шаг 2 — `src/lib/auth.tsx`:**
- Добавить `signInWithVK(code, deviceId, codeVerifier): Promise<{error: string|null}>`
- Добавить в `AuthContextValue` и `AuthProvider`

**Шаг 3 — `src/pages/Auth.tsx`:**
- Кнопка «Войти через ВК» с иконкой VK
- При клике: генерировать PKCE-пару → сохранить `code_verifier` в `sessionStorage` → редирект на `id.vk.com/authorize`
- В `useEffect`: если в URL есть `?code=` и `?provider=vk` → достать `code_verifier` из `sessionStorage` → вызвать `signInWithVK`

**Env:**
- `VITE_VK_APP_ID` — публичный (во фронтенде)
- Секреты не нужны (PKCE, без client_secret)

**Файлы:** `supabase/functions/vk-auth/index.ts` (новый), `src/lib/auth.tsx`, `src/pages/Auth.tsx`  
**Проверить:** клик «Войти через VK» → редирект на VK → авторизация → возврат на `/login` → `session.user` установлен → редирект в `/books` → повторный вход без ввода данных

---

## Фичи на исследование

> ⚠️ **Перед реализацией каждой из этих задач:** получить одобрение, проверить соответствие философии «Literary · Precise · Immersive», провести ресёрч необходимости (аналоги, боли пользователей, риски усложнения интерфейса).


---



### R1. Страница профиля пользователя + загрузка аватара

**✅ Частично готово (2026-06-11):** OAuth-аватар (Google/Telegram) автоматически показывается в SidebarFoot — без миграций, читается из `user_metadata`.

**Что осталось (реализовать после первых пользователей):**
- Страница `/profile`: загрузка своего фото, смена отображаемого имени
- Supabase Storage бакет `avatars/` + RLS
- `profiles.display_name` + `profiles.avatar_url` (миграция 0034)

Спек и план готовы: `docs/superpowers/specs/2026-06-11-profile-avatar-design.md`, `docs/superpowers/plans/2026-06-11-profile-avatar.md` (Tasks 1–3, 5, 7–10).

**Триггер:** кто-то из реальных пользователей попросит сменить имя или фото.

---

### R2. Ревизия футера лендинга

**Что это:** переосмыслить набор иконок/ссылок в футере `Landing.tsx`. Текущее состояние: есть GitHub, нет Telegram.

**Что изменить:**
- ➕ Добавить Telegram (личный канал или чат проекта — определиться когда запустится)
- ➖ Убрать GitHub (репо закрытое — ссылка не несёт ценности для пользователей)
- ⬜ ВКонтакте — добавить позже, если будет заведён канал

**Не делать сейчас:** нет Telegram-канала. Сделать одновременно с созданием канала.

---

### R3. AI-генерация синопсиса главы

**Что это:** кнопка «Сгенерировать» на карточке Corkboard — текст главы уходит во внешний AI API, возвращается 1-2 предложения о содержании сцены.

**Контекст:** аналог «Ранее в книге» в Яндекс Книгах (Alice AI, реализовано 2025). Сейчас синопсис ручной (реализовано 2026-06-06). AI-вариант уместен как Pro-функция. Есть как платные, так и бесплатные AI API с достаточным лимитом для этой задачи — выбрать провайдера при реализации. Оптимальный UX — явная кнопка «Сгенерировать», а не авто при сохранении. Требует Supabase Edge Function для хранения API-ключа на сервере.

**Не реализовывать пока:** нет платящих пользователей → неизвестен ROI.

---

### R4. Relationship Map — визуальный граф персонажей

**Что это:** визуальная схема связей: узлы = персонажи, рёбра = отношения с подписями. Force-directed граф, интерактивный (клик → карточка).

**Контекст:** §13 двусторонние связи ✅ — данные уже в БД. Это только visual layer поверх готовых данных. Campfire сделал Relationship Map killer feature. Особенно ценно для больших ансамблей (fantasy, семейные саги). Риск: «красивый но бесполезный» граф (как Global Graph в Obsidian) — важно, чтобы это был граф конкретного персонажа, а не всего мира.

**Библиотека:** `@visx/graph` или `vis-network`. **Файлы:** новая страница или панель в `Characters.tsx`

---

### R5. Позиционирование обложки (crop/pan)

**Что это:** при загрузке изображения обложки — возможность сдвинуть кадр (drag) и задать `object-position`, чтобы фото центрировалось по нужной части.

**Контекст:** сейчас обложка показывается с `center/cover` без возможности кадрирования. Если фото портретное — работает хорошо; если пейзажное или с важным элементом в углу — нет. Реализовывать в `CoverPicker.tsx`: overlay с draggable-маской, сохранять `cover_position: string` (CSS value) вместе с URL.

**Не реализовывать пока:** low-priority, достаточно текущего поведения для начального запуска.

---

## Заморожено

_Задачи с явным "не делать сейчас". Вернуться когда появится реальная пользовательская обратная связь._

### F1. Соавторство — real-time редактирование

**Что это:** два пользователя редактируют одну главу одновременно, видят курсоры друг друга. Самая сложная фича соавторства — требует Y.js + TipTap Collaboration Extension.

**Что сделать:** реализовывать не раньше 100 платящих пользователей. Варианты бэкенда: Supabase Realtime с Y.js, Hocuspocus на Fly.io/Timeweb. TipTap v3 поддерживает Y.js нативно.

**Deps:** §7 (базовое соавторство)

---

### F2. Снапшот при смене статуса главы — нужно ли объединять?

**Что это:** вопрос о связи статуса главы (черновик / в работе / готово) и Named Snapshots.

**Варианта два, нужно обдумать:**

1. **Авто-тост при смене на «Готово»:** при переводе главы в статус «Готово» — показывать ненавязчивый тост «Зафиксировать версию?» с кнопкой «Сохранить». Нажал — создаётся именованный снапшот «Готово · [дата]» без открытия панели версий. Отклонил — ничего не происходит.

2. **Оставить раздельно:** статус — это пометка для навигации и структуры, снапшот — точка возврата текста. Разные цели, разные триггеры. Объединение создаёт неожиданное поведение.

**Не делать сейчас.** Вернуться после того как появятся реальные пользователи — они покажут, хотят ли они этого сами.

---

## Скиллы — установить позже

> Эти три скилла зависят от конкретного этапа продукта. Вернуться к ним когда наступит нужный момент.

### 🔵 marketingskills — `coreyhaines31/marketingskills`
**Когда:** перед публичным запуском.  
**Что даёт:** 50+ скиллов — аудит onboarding и signup-воронки (`/cro`, `/signup`, `/onboarding`), копирайтинг лендинга (`/copywriting`), SEO (`/seo-audit`, `/ai-seo`), настройка аналитики (`/analytics`), реферальная программа (`/referrals`).  
**Что проверить в первую очередь:** `/onboarding` (активация после регистрации), `/cro` (конверсия лендинга), `/seo-audit` (технический SEO).  
**Установка:** `npx skills add coreyhaines31/marketingskills`

### 🔵 Frontend Slides — `zarazhangrui/frontend-slides`
**Когда:** перед питчем, Product Hunt лонч или при создании презентации для инвесторов/курса.  
**Что даёт:** генерация HTML-презентаций с реальными скриншотами приложения вместо заглушек.  
**Сейчас рано:** нет аудитории, которой нужна презентация.  
**Установка:** `npx skills add zarazhangrui/frontend-slides`

### 🔵 Expense Tracker Market — `AlariCode/expense-tracker-market`
**Когда:** при подключении Robokassa (§4) и запуске монетизации.  
**Что даёт:** возможно — паттерны для биллинговых UI и маркетплейс-механик. Изучить README при запуске §4.  
**Установка:** `npx skills add AlariCode/expense-tracker-market`

## CI/CD — роль Vercel-деплоя и ветковая стратегия

> Обновлено 2026-06-10. Vercel починен (Production Branch → `main`), но его **назначение** требует решения. Не срочно — основной прод (VPS) работает.

### Текущее состояние (после фикса 2026-06-10)
- Пуш в `main` → деплой **одновременно** на Timeweb VPS (GitHub Actions) И на Vercel production.
- **Timeweb** (avtorstudio.com) — основной прод, Supabase через `/sb/` прокси на VPS (обходит RU-throttling).
- **Vercel** (avtorskaya-studiya.vercel.app) — параллельный прод, Supabase **напрямую** на supabase.co, скрыт от поисковиков (`X-Robots-Tag: noindex`).
- Ветка `vercel-preview` больше не прод-ветка Vercel — кандидат на удаление.

### Ключевое ограничение: Vercel ≠ полноценный failover для РФ
1. **Прямой `supabase.co` throttled в РФ** — Vercel не использует VPS-прокси, поэтому для российских пользователей без VPN данные грузятся медленно/не грузятся. Failover деградирован именно для основной аудитории.
2. **`*.vercel.app` периодически блокируется в РФ** — ненадёжная точка доступа для россиян.
3. **После §3 (self-host Supabase на VPS)** — VPS `/sb/` будет указывать на локальную базу в РФ, а Vercel (прямой supabase.co) — на осиротевшую Cloud-базу. Два деплоя начнут показывать **разные данные**.

### Реалистичные роли Vercel (выбрать одну/несколько)
- **A. Failover для зарубежных/VPN-пользователей** — для них прямой supabase.co быстрее VPS-прокси. Узкая аудитория (диаспора, эмигранты).
- **B. Smoke-test сборки** — Vercel на каждый пуш проверяет, что `npm run build` проходит и приложение поднимается. Дешёвая страховка от «сломал прод-сборку». Почти бесплатно, уже работает.
- **C. Staging из ветки `dev`** — main → оба прода; `dev`/PR → Vercel preview для QA до мержа. Preview-деплои создаются автоматически для любой ветки кроме main.
- **D. Отключить Vercel** — если §3 (self-host) делает его бесполезным, проще убрать и оставить только VPS.

### Решения, которые надо принять (перед §3)
1. Какую роль(и) из A–D берём.
2. Судьба Vercel после §3: переключить на self-hosted Supabase (через публичный доменный прокси) или отключить.
3. Удалить отставшие ветки `vercel-preview` и `dev` (10+ коммитов позади) — или оживить `dev` под staging (вариант C).
4. e2e в `ci.yml`: гонять против Vercel preview URL (реальный деплой) вместо localhost.
5. `deploy-timeweb.yml`: убрать повторный `check` джоб (уже прошёл в `ci.yml`) — заменить на `workflow_run` с условием success.

### Почему не срочно
Основной прод (VPS) работает, Vercel теперь актуален и не мешает. Решение о роли логично принять **перед §3** — именно при self-host конфигурация Vercel станет критичной (риск разъехавшихся данных).

---

### §INFRA-1. Объектное хранилище для снимков глав (S3/Blob)

**Что это:** сейчас HTML-контент снимков хранится прямо в PostgreSQL (`chapter_versions.content TEXT`). При росте числа Pro-пользователей это дорого: Supabase берёт $0.125/ГБ/мес за БД, тогда как Cloudflare R2 стоит $0.015/ГБ/мес.

**Суть изменения:** вынести `content` из PostgreSQL в объектное хранилище (Cloudflare R2 или Supabase Storage). В таблице `chapter_versions` хранить только метаданные + `storage_key` (путь к файлу). `getVersionContent` становится `fetch` вместо SQL. `pruneVersions` — сначала удаляет файлы, потом строки.

**Когда делать:** при 500+ активных Pro-пользователях или когда база `chapter_versions` превысит 4 ГБ. До этого — преждевременная оптимизация. Текущий объём — единицы МБ.

**Файлы:** `src/lib/versions.ts`, `supabase/migrations/` (убрать `content` из таблицы, добавить `storage_key`).

---

### 🟡 Graphify — семантический анализ (следующий шаг)
**Статус:** частично установлен. AST-граф (6323 узла) работает, скилл активен в Claude Code.  
**Что осталось:** семантический проход через LLM — понимает документацию, комментарии, связи между `docs/` и кодом.  
**Как включить:** передать `ANTHROPIC_API_KEY` → `graphify .` из корня проекта (одноразово, ~$0.05–0.20 на весь проект).  
**Что даст:** Claude сможет отвечать на архитектурные вопросы без сканирования файлов; особенно полезно для `docs/features/`, `supabase/migrations/` и связей типа «какие компоненты используют этот хук».  
**Обновление графа после изменений:** `graphify update .` (бесплатно, AST-only).


