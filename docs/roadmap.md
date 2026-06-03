# Roadmap — Авторская студия

_Обновлён: 2026-06-03 (38 задач закрыто)_



**Сейчас:** _(не задана — заполнить в начале сессии)_

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

### 1. Transactional email — Resend SMTP + брендированные шаблоны

**Симптом:** при регистрации пользователь получает некрасивое дефолтное письмо от Supabase.

**Что готово:** 4 HTML-шаблона в стиле студии → `docs/email-templates/`. Подробная инструкция → `docs/email-templates/SETUP.md`.

**Что осталось (ручные шаги, ~15 мин):**
1. Зарегистрироваться на resend.com
2. Domains → Add Domain: `avtorstudio.com` → добавить DNS-записи в Timeweb → дождаться Verified ✓
3. API Keys → Create API Key → скопировать (`re_...`)
4. Supabase Dashboard → **Project Settings → Authentication → SMTP Settings** → Enable Custom SMTP:
   - Host: `smtp.resend.com` · Port: `465` · Username: `resend` · Password: `<API-ключ>`
   - Sender Name: `Авторская студия` · Sender Email: `hello@avtorstudio.com`
5. Supabase Dashboard → **Authentication → Email Templates** → вставить HTML из 4 файлов

**Файлы:** `docs/email-templates/confirm-signup.html`, `reset-password.html`, `magic-link.html`, `email-change.html`
**Проверить:** зарегистрировать тестового пользователя → inbox → брендированное письмо с тёмным фоном студии

---

### 2. Уведомление Роскомнадзора перед публичным запуском ⚠️

**Что это:** по закону ФЗ-152 любой сайт, собирающий данные пользователей (email, имя), обязан зарегистрироваться как оператор персональных данных. Штраф за отсутствие — ~5 000 ₽, но при проверке могут быть последствия серьёзнее.

**Что сделать:** зайти на pd.rkn.gov.ru, заполнить форму (~30 минут). Указать: оператор — физлицо (ФИО), цель обработки — регистрация и авторизация пользователей, категории данных — email.

**Файлы:** нет (ручное действие на pd.rkn.gov.ru)
**Проверить:** скриншот/email подтверждения от РКН

---

### 3. SEO-индексация перед публичным запуском

**Контекст:** приложение — Vite + React SPA. Яндексбот практически не рендерит JS, поэтому без pre-rendering лендинг не проиндексируется. Все шаги ниже — обязательные, выполнять последовательно.

**Шаг 0 — ✅ Выполнено:** `X-Robots-Tag: noindex, nofollow` добавлен в `vercel.json`. После деплоя удалить `avtorskaya-studiya.vercel.app` из Google Search Console (Google обработает noindex за 1–2 недели).

**Шаг 1 — ✅ Выполнено:** Pre-rendering через `scripts/prerender.mjs` (Playwright + vite preview). Рендерит `/`, `/privacy`, `/terms` → HTML в `dist/`. `npm run build` запускает пострендер автоматически. В CI (`deploy-timeweb.yml`) добавлен шаг `npx playwright install chromium --with-deps`.

**Шаг 2 — Meta-теги:**
- ✅ `<link rel="canonical" href="https://avtorstudio.com/">` — добавлен в `index.html`
- ✅ `og:url`, `og:image`, `twitter:image` — исправлены на `avtorstudio.com` в `index.html`
- ✅ Schema.org JSON-LD — `SoftwareApplication` + `FAQPage` с 6 вопросами добавлены в `index.html`
- ✅ `X-Robots-Tag: noindex` на `/books/*`, `/login`, `/admin` и т.д. — nginx `deploy/nginx.conf`. Применить на VPS: скопировать конфиг → `nginx -t && systemctl reload nginx`
- ⬜ `<meta name="yandex-verification" content="...">` — получить код на webmaster.yandex.ru, раскомментировать placeholder в `index.html`

**Шаг 3 — ✅ Выполнено:** `public/robots.txt` исправлен. `public/sitemap.xml` создан.

**Шаг 3.1 — ✅ Выполнено:** Ключевые слова «онлайн-редактор для писателей на русском языке» добавлены в subtitle секции «Возможности» (`src/pages/Landing.tsx:408`).

**Шаг 4 — Яндекс.Вебмастер (ручной шаг):**
1. Зарегистрировать `avtorstudio.com` на webmaster.yandex.ru
2. Получить код верификации → раскомментировать `<meta name="yandex-verification">` в `index.html` → задеплоить
3. Добавить sitemap `https://avtorstudio.com/sitemap.xml`

**Шаг 5 — Яндекс.Метрика (ручной шаг):**
Создать счётчик на metrika.yandex.ru → заменить `XXXXXXXX` на ID → раскомментировать блок в `index.html` → задеплоить.

**Шаг 6 — Google Search Console (ручной шаг):**
Верификация через `public/google41b7face4a88ca87.html` уже есть. ⬜ Загрузить `https://avtorstudio.com/sitemap.xml` в GSC → Sitemaps. После подтверждения удалить `avtorskaya-studiya.vercel.app` из GSC.

**Файлы:** `scripts/prerender.mjs`, `deploy/nginx.conf`, `src/pages/Landing.tsx`, `index.html`, `.github/workflows/deploy-timeweb.yml`
**Проверить:** `npm run build` → view-source на `dist/index.html` → полный HTML лендинга (не пустой `<div id="root">`)
**Deps:** §2 желательно сделать раньше

> 🛠 **Скиллы:** `/ai-seo` и `/seo-audit` из `marketingskills` — для аудита после индексации; `/site-architecture` — если понадобится расширить структуру публичных страниц.

---

### 4. ЮKassa — платёжный провайдер

**Что это:** без платёжной системы нет монетизации. ЮKassa поддерживает самозанятых (4% с физлиц), работает без ИП.

**Что уже сделано:**
- ✅ `supabase/functions/yukassa-webhook/index.ts` — вебхук обрабатывает `pro`, `pro_annual`, `lifetime`; верифицирует платёж через ЮKassa API; декрементирует `lifetime_slots_remaining`; ставит `grandfathered = true` если `GRANDFATHERING_ENDS_AT` не истекло
- ✅ `app_settings.lifetime_slots_remaining = 50` + атомарный RPC `decrement_lifetime_slot()` (миграция 0025)
- ✅ `profiles.grandfathered boolean` (миграция 0026)
- ✅ Лендинг и UpgradeModal показывают живой счётчик Lifetime-слотов; при 0 вариант скрывается
- ✅ В настройках у грандфазированных пользователей: «✦ Ранняя цена · 290 ₽/мес навсегда»

**Что осталось сделать:**
1. Зарегистрироваться в ЮKassa, получить `shop_id` и `secret_key`. Включить интеграцию с ФНС (чеки для самозанятых — автоматически, бесплатно).
2. Установить Secrets в Supabase Dashboard → Edge Functions → Secrets:
   - `YUKASSA_SHOP_ID`, `YUKASSA_SECRET_KEY`
   - `GRANDFATHERING_ENDS_AT` = ISO-дата окончания грандфазеринга, например `2026-09-01`
3. Задеплоить Edge Function: `supabase functions deploy yukassa-webhook --project-ref joaxeoavjvlqmtlepkrr`
4. Зарегистрировать URL вебхука в ЮKassa Личном кабинете: `https://joaxeoavjvlqmtlepkrr.supabase.co/functions/v1/yukassa-webhook`
5. Построить flow создания платежа: при клике «Оформить подписку» / «Купить Lifetime» — создать платёж через ЮKassa API с `metadata: { user_id, plan: 'pro'|'lifetime' }`, перенаправить на `confirmation.confirmation_url`. После оплаты ЮKassa вызывает вебхук автоматически.
6. Добавить акцепт оферты у кнопки оплаты (требование §5).

**Файлы:** `supabase/functions/yukassa-webhook/index.ts` (готово), `src/components/SettingsModal.tsx` (кнопки → реальный чекаут), `src/pages/Landing.tsx` (то же)
**Проверить:** тестовый вебхук ЮKassa (из Личного кабинета) → `profiles.plan = 'pro'` обновляется → `SettingsModal` показывает Pro; Lifetime → `lifetime_slots_remaining` убывает
**Deps:** §5 (оферта)

---


### 8. Соавторство — приглашение редактора

**Что это:** владелец книги может пригласить другого пользователя редактировать. Нужна таблица `book_collaborators` с ролями `editor | viewer`.

**Что сделать:** миграция — таблица `book_collaborators (book_id, user_id, role, invited_by, created_at)`. Владелец вводит email → создаётся pending-запись → пользователь получает email с ссылкой → принимает приглашение. RLS: `auth.uid() = user_id OR EXISTS (SELECT 1 FROM book_collaborators WHERE book_id = ... AND user_id = auth.uid())`.

**Файлы:** `supabase/migrations/` (таблица `book_collaborators`), `src/App.tsx` (маршрут принятия приглашения), `src/components/SettingsModal.tsx` или новый `CollaboratorsPanel`
**Проверить:** владелец приглашает email → приглашённый видит книгу в Dashboard с ролью `editor` → RLS блокирует удаление книги не-владельцем

---

### 9. Сделать репозиторий приватным

**Что это:** репозиторий https://github.com/XDobriev/writers_studio сейчас публичный — `VITE_SUPABASE_ANON_KEY` виден в истории коммитов. Для коммерческого SaaS с реальными пользователями это стандарт — сделать до публичного запуска.

**Что сделать:** GitHub → Settings → Danger Zone → Change visibility → Private.

**На что не влияет:** GitHub Actions, Vercel авто-деплой, Supabase — всё работает без изменений.

**Файлы:** нет (GitHub Settings)
**Проверить:** `git clone https://github.com/XDobriev/writers_studio` без авторизации → `Repository not found`

---

### 10. Ручное тестирование перед публичным запуском

**Что это:** полный прогон критических пользовательских сценариев перед первым публичным запуском. ~1–2 часа. Аккаунт для тестирования: `e2e@avtorskaya-studiya.vercel.app`.

#### Критично — блокирует запуск

| # | Сценарий | Ожидаемый результат |
|---|---|---|
| 1 | Регистрация нового пользователя | Письма нет (confirm отключён), сразу попадает в Home |
| 2 | Повторный вход | Сессия восстанавливается без ошибки |
| 3 | Выход из аккаунта | Редирект на Landing, `/books/*` заблокирован |
| 4 | Создать книгу → создать главу → напечатать текст → подождать 3 сек → обновить страницу | Текст сохранился |
| 5 | Split-режим на 375px | ✅ Редирект на Editor (split недоступен на мобильном) |
| 6 | ЮKassa тестовый платёж → webhook | `profiles.plan` обновился в SettingsModal (когда §4 будет реализован) |

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

### 11. Мобильный QA перед релизом — проверка всех сценариев

**Что это:** перед публичным запуском проверить отображение и функциональность всех элементов интерфейса во всех пользовательских сценариях на мобильных устройствах. Охватить весь флоу: регистрация → создание книги → редактор → персонажи → хронология → карта → экспорт → настройки.

**✅ Исправлено (2026-06-03) — mobile-first responsive:**
- Notes: сайдбар скрыт на мобильном, контент занимает всю ширину
- Characters: список персонажей доступен на мобильном (showMain=true), grid адаптирован
- Split: редирект на Editor при isMobile (split не имеет смысла на маленьком экране)
- Map: canvas заполняет высоту (height: 100% + minHeight: 0 на main)
- CSS: добавлены media queries для tablet (768–1023px) и mobile (<768px) в design-system.css

**Что проверить по разделам:**
- Лендинг и авторизация — корректность на 375px (iPhone SE) и 390px (iPhone 14).
- Дашборд книг — карточки, кнопки создания, навигация.
- Редактор — все 4 режима (studio / left / right / page), тулбар форматирования, сохранение.
- Картотека персонажей — ✅ layout исправлен; проверить поиск и детальную карточку.
- Хронология — скролл, добавление событий, EventCard.
- Карта мира — ✅ canvas-высота исправлена; проверить touch-жесты.
- Заметки — ✅ layout исправлен; проверить полный флоу.
- Модалы (настройки, подтверждения, версии) — не выходят ли за экран.

**Файлы:** `src/components/Chrome.tsx`, `src/components/EditorHybrid.tsx`, `src/pages/Characters.tsx`, `src/pages/Timeline.tsx`, `src/pages/Map.tsx`, `src/pages/Notes.tsx`
**Проверить:** DevTools → Responsive 375px → полный флоу без overflow / обрезанных кнопок / недоступных tap-таргетов

> 🛠 **Скиллы:** `gstack` — скриншоты в реальном браузере; `systematic-debugging` — при обнаружении багов.

---

### 12. Ambient Sounds — заменить синтетические звуки на реальные записи

**Что это:** сейчас `public/sounds/*.wav` — это синтетический шум (белый/розовый/коричневый), сгенерированный скриптом Node.js. Для продакшена нужны реальные атмосферные записи.

**Что сделать:**

1. Зайти на [freesound.org](https://freesound.org) (бесплатный аккаунт).
2. Найти и скачать 5 звуков с лицензией **CC0** или **CC BY** (Attribution). Искать по запросам:
   - `cafe ambience loop` → сохранить как `cafe.wav`
   - `rain ambience loop` → `rain.wav`
   - `forest birds ambience` → `forest.wav`
   - `fireplace crackling loop` → `fire.wav`
   - `white noise` → `noise.wav`
3. Скачать в формате **WAV или MP3**. Если MP3 — переименовать расширение в `.wav` (браузер читает оба формата по содержимому), либо обновить расширения в `src/components/StatusBar.tsx` в массиве `SOUNDS` (строки 15–21).
4. Положить файлы в `public/sounds/`.
5. Рекомендуемая длина: **60–120 секунд** (loop будет незаметнее швов). Размер до 3MB на файл.

**Альтернативный источник (проще):** [pixabay.com/sound-effects](https://pixabay.com/sound-effects/) — скачивание без регистрации, лицензия CC0. Искать `rain loop`, `cafe background`, `forest ambience`, `fireplace`, `white noise`.

**Файлы:** `src/components/StatusBar.tsx` (массив `SOUNDS`, строки 15–21), `public/sounds/`
**Проверить:** `npm run dev` → `/books/<ID>/editor` → иконка наушников в StatusBar → выбрать звук → fade in 0.5s → переключить → crossfade → «× Стоп» → fade out

---

## Фичи на исследование

> ⚠️ **Перед реализацией каждой из этих задач:** получить одобрение, проверить соответствие философии «Literary · Precise · Immersive», провести ресёрч необходимости (аналоги, боли пользователей, риски усложнения интерфейса).


---



### §R5. Relationship Map — визуальный граф персонажей

**Что это:** визуальная схема связей: узлы = персонажи, рёбра = отношения с подписями. Force-directed граф, интерактивный (клик → карточка).

**Контекст:** §13 двусторонние связи ✅ — данные уже в БД. Это только visual layer поверх готовых данных. Campfire сделал Relationship Map killer feature. Особенно ценно для больших ансамблей (fantasy, семейные саги). Риск: «красивый но бесполезный» граф (как Global Graph в Obsidian) — важно, чтобы это был граф конкретного персонажа, а не всего мира.

**Библиотека:** `@visx/graph` или `vis-network`. **Файлы:** новая страница или панель в `Characters.tsx`

---

---

## Заморожено

_Задачи с явным "не делать сейчас". Вернуться когда появится реальная пользовательская обратная связь._

### §F1. Соавторство — real-time редактирование

**Что это:** два пользователя редактируют одну главу одновременно, видят курсоры друг друга. Самая сложная фича соавторства — требует Y.js + TipTap Collaboration Extension.

**Что сделать:** реализовывать не раньше 100 платящих пользователей. Варианты бэкенда: Supabase Realtime с Y.js, Hocuspocus на Fly.io/Timeweb. TipTap v3 поддерживает Y.js нативно.

**Deps:** §8 (базовое соавторство)

---

### §F2. Снапшот при смене статуса главы — нужно ли объединять?

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

### 🔵 SEO/GEO — `aaron-he-zhu/seo-geo-claude-skills`
**Когда:** перед публичным запуском / при появлении лендинга с органическим трафиком.  
**Что даёт:** keyword-стратегия, технический аудит, структурированные данные, GEO-оптимизация под AI-поиск.  
**Сейчас рано:** SPA за авторизацией — поисковики не видят контент.  
**Установка:** `npx skills add aaron-he-zhu/seo-geo-claude-skills`

### 🔵 Frontend Slides — `zarazhangrui/frontend-slides`
**Когда:** перед питчем, Product Hunt лонч или при создании презентации для инвесторов/курса.  
**Что даёт:** генерация HTML-презентаций с реальными скриншотами приложения вместо заглушек.  
**Сейчас рано:** нет аудитории, которой нужна презентация.  
**Установка:** `npx skills add zarazhangrui/frontend-slides`

### 🔵 Expense Tracker Market — `AlariCode/expense-tracker-market`
**Когда:** при подключении платёжной системы (ЮKassa §4) и запуске монетизации.  
**Что даёт:** возможно — паттерны для биллинговых UI и маркетплейс-механик. Изучить README при запуске §3.  
**Установка:** `npx skills add AlariCode/expense-tracker-market`

## CI/CD — реструктуризация деплоя

> Обдумать неспешно, не срочно. Текущий минимальный фикс уже сделан (typecheck блокирует Timeweb-деплой).

### Проблема
Два параллельных деплоя на каждый пуш в `main` с разными гарантиями качества:
- Timeweb (настоящий прод) — деплоится без e2e-тестов
- Vercel (staging) — блокируется e2e, но второстепенен

Ветки `dev` и `vercel-preview` отстают от `main` на 10+ коммитов и фактически не используются.

### Желаемый флоу
```
dev → Vercel preview (авто) → e2e тесты → merge в main → Timeweb прод
```

### Что нужно сделать
1. **e2e в `ci.yml`** запускать против Vercel preview URL (не localhost) — тогда тесты проверяют реальный деплой.
2. **`deploy-timeweb.yml`** убрать повторный `check` джоб (уже прошёл в `ci.yml`) — вместо этого использовать `workflow_run` с условием success.
3. **Удалить `vercel-preview` ветку** — дублирует `dev`.
4. **Настроить `dev` → Vercel preview** как официальный staging-флоу.

### Почему не делать сейчас
Требует осмысленного решения по ветковой стратегии и настройки Vercel project settings. Риск поломать деплой во время активной разработки.

---

### 🟡 Graphify — семантический анализ (следующий шаг)
**Статус:** частично установлен. AST-граф (6323 узла) работает, скилл активен в Claude Code.  
**Что осталось:** семантический проход через LLM — понимает документацию, комментарии, связи между `docs/` и кодом.  
**Как включить:** передать `ANTHROPIC_API_KEY` → `graphify .` из корня проекта (одноразово, ~$0.05–0.20 на весь проект).  
**Что даст:** Claude сможет отвечать на архитектурные вопросы без сканирования файлов; особенно полезно для `docs/features/`, `supabase/migrations/` и связей типа «какие компоненты используют этот хук».  
**Обновление графа после изменений:** `graphify update .` (бесплатно, AST-only).

---

## Закрыто

_2026-06-03:_ fix(shortcuts) §10 аудит горячих клавиш — два бага исправлены: `Ctrl+Enter` вставлял `<br>` в текущую главу параллельно с созданием новой (добавлен `!e.defaultPrevented` в `useKeyboardShortcuts`); `Ctrl+Shift+N` конфликтовал с инкогнито Chrome (переименован в `Ctrl+Shift+M`); остальные шорткаты корректны во всех 4 режимах, Mac Cmd-замена работает ✅

_2026-06-03:_ feat(monetization) §6 Lifetime deal + §7 Грандфазеринг — `app_settings.lifetime_slots_remaining = 50`, RPC `decrement_lifetime_slot` (миграция 0025); `profiles.grandfathered boolean` (миграция 0026); вебхук декрементирует счётчик и ставит `grandfathered` если `GRANDFATHERING_ENDS_AT` не истекло; лендинг и UpgradeModal показывают живой счётчик, скрывают Lifetime при 0; настройки показывают «✦ Ранняя цена» ✅

_2026-06-03:_ feat(legal) §5 оферта, акцепт, email-подтверждение — `/offer` страница, акцепт у кнопок Pro/Lifetime, Edge Function `payment-confirmation` (Resend) ✅

_2026-06-03:_ seo(prerender) §3 — `scripts/prerender.mjs` (Playwright + vite preview): рендер `/`, `/privacy`, `/terms` → HTML в `dist/` при сборке; nginx `X-Robots-Tag: noindex` для `/books/*`, `/login`, `/admin`; ключевые слова в subtitle лендинга; `index.html` placeholders для Метрики + Вебмастера ✅

_2026-06-03:_ fix(a11y) три contrast failure в светлой теме — цвета приведены к WCAG AA ✅; fix(characters) не запускать auto-select в промежуточном состоянии `activeId=null` ✅; ci: hardening — pre-push hook, tiptap patch-pin, E2E robust wait, HTML report ✅; fix(e2e) заменить `page.goto` на in-app переход в `characters-create` ✅; seo: canonical, og-теги, sitemap, Schema.org + UI-правки лендинга ✅

_2026-06-02:_ feat(editor) §R4 Hover card — карточка персонажа при наведении: `useCharacterHover` (mousemove 500ms debounce, Unicode alias matching) + `CharacterHoverCard` (портал, аватар, роль, snippet, навигация) ✅

_2026-06-02:_ fix(export) EPUB indent-режим — первый абзац главы не получает красную строку (`p:first-of-type{text-indent:0}` добавлен в EPUB CSS, аналогично HTML) ✅

_2026-06-02:_ feat(editor) §R6 Focus Mode — затемнение абзацев при письме: `@tiptap/extension-focus` + `.focus-mode` CSS + тоггл-кнопка в StatusBar ✅

_2026-06-02:_ fix(versions) §R2 Named Snapshots — именованные вехи всегда сохраняются при ручном создании, даже если контент не изменился с последнего авто-снимка ✅

_2026-06-02:_ feat(dashboard) §R1 Completion ETA + weekly summary toast — avg7 слов/день → прогноз завершения в блоке «Цель по словам»; тост в понедельник с итогом прошлой недели ✅

_2026-06-02:_ fix(export) описание «для публикации на сайте» при выборе HTML-формата в экспорте ✅

_2026-06-02:_ chore(seo) `X-Robots-Tag: noindex, nofollow` в `vercel.json` — Vercel-деплой скрыт от поисковиков ✅; fix(a11y) `aria-label="Выйти из аккаунта"` на кнопке в `Home.tsx:178` ✅

_2026-06-02:_ fix(ux) модалка «Редактировать книгу» — Dashboard приведён к `modal-overlay/modal-panel`, `editGenre` (string) → `editGenres` (string[]) + `GenrePicker`; жанры корректно читаются из `book.genres`; Home.tsx — заголовок `font-serif` → `font-ui` ✅

_2026-06-01 (сессия 2):_ fix(css) `text-align: justify` в `.sheet p` — проза отображается по ширине ✅; fix(a11y) `aria-label` на логотипе и кнопке Настройки в RailNav ✅; fix(ux) подсказки форматов — «Новелла 10–20 тыс.» + «Эпос / сага» вместо «Эпическое фэнтези» ✅; fix(a11y) Dashboard модалка «Редактировать книгу» — `role="dialog"`, `aria-modal`, Tab-trap ✅

_2026-06-01:_ fix(chapters) умная нумерация в Corkboard + Editor — `max(Глава N)+1` как в Outline ✅; fix(roadmap) модалка «Редактировать книгу» — `padding: 28px` симметричен, баг не воспроизводится ✅; fix(auth) `.input--err` на полях email/password при ошибке входа + сброс при наборе ✅; fix(design) `#fff`→`oklch(0.98 0 0)` в bubble-menu ✅; fix(design) убран `box-shadow` с `.note-card:hover` ✅; fix(a11y) `aria-label="Тип заметки"` на select в RightPanel ✅; fix(css) `.sb-share-btn` — убраны дублирующиеся inline-стили ✅; fix(design) spell-popup переведён на дизайн-токены ✅; fix(roadmap) убран баг «Белая рамка экспорта» (уже исправлен кастомным дропдауном) ✅; fix(statusbar) кнопка «Повторить» при ошибке сохранения ✅; fix(rp-tab) `type="button"` на вкладках — уже присутствовало ✅

_2026-05-31:_ feat(sentry) `@sentry/react` подключён в `main.tsx` — мониторинг ошибок в проде ✅; §16 жанры книги — `genres text[]`, `GenrePicker`, multi-select с «Другое» ✅; feat(pov) `is_pov` column in `chapter_characters`, `useChapterPovMap`, утилиты управления POV-записями ✅; feat(design) палитра цветов персонажей ✅; fix(backlinks) не удалять POV-записи при обновлении ✅

_2026-05-30:_ §28а рефакторинг — useDebouncedSave, useCharacterNavigation, useCharacterMutations ✅; §13 двухсторонние связи персонажей ✅; planRef null-init ✅; debounce removeAlias ✅; feat(landing) hero stagger/float/FAQ chevron анимации ✅; §33 адаптив breakpoints ✅; §26 вкладки настроек ✅; §28 тема-в-настройках ✅; §3 UpgradeModal ✅; §28а рефакторинг хуков ✅

_2026-05-29:_ fix(snapshots) words=0 при создании книги ✅; feat(map) режимы в сайдбар карты ✅; §8 онбординг в `profiles.onboarded_at` ✅; fix(state) гонки состояний useEffect+Supabase ✅; feat(motion) §39-45 — page transitions, анимации входов/выходов, skeleton ✅; feat(outline) pacing visualization — бар длины глав ✅; feat(characters) психология + алиасы + бэклинки (авто-поиск упоминаний персонажей по главам) ✅; feat(characters) подсказки псевдонимов из текста ✅; fix(dashboard) heatmap audit — streak bug, best-day badge, intensity legend ✅; §34 SidebarFoot div→button ✅; §35 автофокус дропдауна ✅; §21 BrowserMock URL ✅; §19 убрана ЮKassa из pricing ✅; §20 footer живые ссылки ✅; §24 единый размер карточек ✅; §15 время чтения на дашборде ✅

_2026-05-28:_ §2 персонажи сайдбар — решено: поиск+фильтры в тулбар, сайдбар навигационный ✅; feat(characters) grid-вид картотеки, убрана правая панель, RelationsBlock inline ✅; feat(nav) единая навигация по разделам книги во всех сайдбарах ✅; §25 feat(sidebar) user block dropdown — Настройки/Выйти ✅; feat(landing) split CTA signup/signin через `?tab=` ✅; fix(settings) гонка состояний — скелетон до загрузки плана ✅

_2026-05-24:_ §36 UX `EventCard` (хронология) — переупорядочивание полей: тип+delete → название → описание → (разделитель) → метаданные (когда+глава); `borderLeft` карточек заменён на `borderTop`. §35: `.tb { padding: 0 8px }` → `0 14px` — единый отступ в тулбарах всех разделов (Dashboard, Characters, Map, Timeline, Corkboard, Outline). §30: inline-баннер при первом входе в режим «Страница» (localStorage `editor-page-hinted`), auto-dismiss 8с. §32: toast при достижении дневной цели по словам — 🎉/💪, 4с, once-per-day через localStorage, анимация `toast-in`. Заметки как примечания автора в DOCX/EPUB/FB2/HTML (§10 подпункт). Fix восстановления версии — применяет контент в TipTap `editor.commands.setContent()`, улучшен diff. Мерцание подчёркиваний при исправлении слова — точечное удаление декорации. Умная автонумерация глав в Outline — `max(Глава N)+1`. Fix RLS drag-drop revert в reorderChapters — upsert→update.

_2026-05-20:_ экспорт DOCX (docx.js + DOMParser), FB2 (pure XML), EPUB (JSZip + OPF + NCX); точки входа в Dashboard и Sidebar; оценка размера файла; язык как выпадающий список.

_2026-05-19:_ мобильный layout Персонажей / Хронологии / Карты; `window.confirm` → `ConfirmDialog`; admin-поиск, сортировка, смена плана; контраст светлой темы (WCAG AA); touch target кнопок статуса глав; мобильная навигация в редакторе (drawer + hamburger); нейминг планов Free/Pro/Lifetime; согласие на обработку ПД (чекбокс + `/privacy`); реквизиты в footer лендинга; `/terms`; OG-картинка; склонение «черновик»; меню главы — пункт «Переименовать»; inline-редактирование названия главы; цель по словам — UX улучшения; цвета заметок — единая палитра; редактор 1024px — порог `showRight` поднят до 1200px.
