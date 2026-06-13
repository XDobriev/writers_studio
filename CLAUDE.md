# Авторская студия — Claude Code

Редактор для писателей. Vite + React + TypeScript, Supabase (Auth + Postgres), деплой на Timeweb VPS + Vercel.

## Боевые ссылки

- **Прод (основной):** https://avtorstudio.com — Timeweb VPS, Ubuntu 24.04
  - Публичный IP (DNS): `72.56.233.223` — NAT Timeweb, для браузера/DNS
  - Реальный IP (SSH): `72.56.232.231` — для rsync/ssh. GitHub Secret `VPS_HOST=72.56.232.231`
- **Прод (резервный):** https://avtorskaya-studiya.vercel.app — Vercel (деплоится параллельно)
- **GitHub:** https://github.com/XDobriev/writers_studio (push в `main` → авто-деплой на оба)
- **Supabase ref:** `joaxeoavjvlqmtlepkrr` · [Dashboard](https://supabase.com/dashboard/project/joaxeoavjvlqmtlepkrr)
- **Vercel project:** `khamza-s-projects/avtorskaya-studiya`
- **Supabase MCP** подключён (`~/.claude.json`, `--project-ref=joaxeoavjvlqmtlepkrr`). Грузить через ToolSearch: `select:mcp__supabase__...`.

## Timeweb VPS

- **IP:** `72.56.233.223`, пользователь `deploy`, SSH-ключ в GitHub Secrets (`VPS_SSH_KEY`)
- **Деплой:** GitHub Actions (`.github/workflows/deploy-timeweb.yml`) — `npm ci` → `npm run build` → `rsync dist/ → /var/www/avtorstudio/dist/`
- **nginx:** `/etc/nginx/sites-available/avtorstudio.com` (конфиг в `deploy/nginx.conf`)
- **SSL:** Let's Encrypt через certbot. Выпущен 2026-05-25, действует до 2026-08-23. Продление автоматическое.
- **Supabase-прокси** активен: `/sb/` в nginx проксирует Supabase, VPS-сборка использует `VITE_SUPABASE_URL=https://avtorstudio.com/sb`

## Команды

```bash
npm run dev        # dev-сервер на 127.0.0.1:5273
npm run build      # продакшен-сборка в dist/
npm run typecheck  # только TS, без сборки
npm run lint       # ESLint: типы + react-hooks/rules-of-hooks (ловит хуки после return)
npm run preview    # превью продакшен-сборки
```

> **После изменений в React-компонентах всегда запускать оба:** `typecheck` + `lint`.

## Архитектура

### Точки входа
- `src/main.tsx` — точка входа, инициализирует `@sentry/react` (мониторинг ошибок в проде).
- `src/App.tsx` — роутер. Все маршруты `/books/:id/...` под `<AuthGuard>`.

### Компоненты
- `src/components/Chrome.tsx` — тонкий barrel: re-exports Sidebar/*, RailNav; содержит WithMode.
- `src/components/Sidebar/Sidebar.tsx` — основной сайдбар: шапка книги, список глав, share.
- `src/components/Sidebar/SidebarFoot.tsx` — футер сайдбара: дропдаун аккаунта, выход.
- `src/components/Sidebar/SidebarNav.tsx` — nav-ссылки сайдбара (Дэшборд, Манускрипт и т.д.).
- `src/components/Sidebar/index.ts` — barrel-экспорт Sidebar/*.
- `src/components/RailNav.tsx` — иконочная рейлнавигация (режимы Focus/Split).
- `src/components/EditorHybrid.tsx` — главный редактор, 4 режима (studio/left/right/page).
- `src/components/CharacterHoverCard.tsx` — портальная hover-карточка персонажа в редакторе: аватар, имя, роль, snippet, навигация в Characters.
- `src/components/MapStampsLayer.tsx` — SVG-слой штампов карты: рендер всех штампов с drag-состоянием и selection ring; получает stamps[], selectedId, dragPos.
- `src/components/RichEditor.tsx` — TipTap wrapper.
- `src/components/EditorToolbar.tsx` — полноценный тулбар TipTap.
- `src/components/RightPanel.tsx` — правая панель редактора: версии, персонажи главы, POV.
- `src/components/SettingsModal.tsx` — настройки пользователя: тема, цель по словам, план.
- `src/components/StatusBar.tsx` — статус-бар: ambient sounds, темп письма, автосохранение.
- `src/components/ConfirmDialog.tsx` — диалог подтверждения (заменяет `window.confirm`).
- `src/components/UpgradePrompt.tsx` — модальный пейволл: замок + текст + кнопка «Перейти на Pro» → `/offer`. Принимает `feature` (`characters`|`timeline`|`export`|`books`) и `onClose`.
- `src/components/GenrePicker.tsx` — мультиселект жанров (`genres text[]`).
- `src/components/Skeleton.tsx` — скелетон-загрузка для async-состояний.
- `src/components/VersionsPanel.tsx` + `VersionModal.tsx` — UI снапшотов/версий.
- `src/components/CharacterFieldCard.tsx` — именованная карточка-поле (label + textarea + warn-состояние); используется в детальном виде персонажа.
- `src/components/CharacterHeroBlock.tsx` — блок героя детальной карточки персонажа: аватар, имя, псевдонимы, цитата, смена роли.
- `src/components/CharacterRelationsBlock.tsx` — блок связей персонажа: форма добавления, пресеты, список строк RelationRow (приватная).
- `src/components/CharacterChaptersTab.tsx` — вкладка «Главы» детальной карточки: POV-главы и упоминания персонажа по главам.
- `src/components/TimelineEventCard.tsx` — карточка события хронологии: редактирование типа, названия, описания, эпохи, главы.
- `src/components/TimelineFilters.tsx` — фильтры хронологии по слоям; `variant="sidebar"|"mobile"` унифицирует два варианта рендера.
- `src/components/PasswordInput.tsx` — поле пароля с toggle-глазом; управляет своим show-состоянием сам.
- `src/components/AccountMenu.tsx` — переиспользуемый дропдаун аккаунта (Настройки + Выйти); render-prop `children` для кастомного триггера; `placement="above"|"below"`.
- `src/components/PageMotion.tsx` — обёртка `motion.div` для анимации переходов между страницами (fade via `pageVariants`); используется в `App.tsx` на каждом маршруте.
- `src/components/SpotlightButton.tsx` — CTA-кнопка с cursor-spotlight эффектом (21st.dev pattern).
- `src/components/AnimatedPricingCard.tsx` — карточка тарифа с hover-lift и glow (21st.dev pattern).
- `src/components/LandingSectionLabel.tsx` — `SectionLabel` + `useScramble`: заголовок секции лендинга со scramble-анимацией kicker-строки.
- `src/components/LandingFeaturesSection.tsx` — секция «Возможности»: 4 FeatureRow с браузерными моками (редактор, пробковая доска, карта, дашборд).
- `src/components/LandingProcessSection.tsx` — секция «Процесс»: 4 шага от пустого листа до экспорта.
- `src/components/LandingPricingSection.tsx` — секция «Цены»: тарифные карточки Free/Pro/Lifetime с динамическим счётчиком слотов.
- `src/components/AuthGuard.tsx` — защита роутов.
- `src/components/ErrorBoundary.tsx` — перехват краша компонентов, fallback UI.
- `src/components/CookieBanner.tsx` — GDPR-баннер куки: Принять / Отклонить, сохраняет выбор (`accepted`|`rejected`) в `localStorage` под ключом `cookie_consent_v1`.
- `src/styles/design-system.css` — CSS-переменные (oklch), классы `.as`, `.sb`, `.tb`, `.sheet`, `.btn`, `.input`, `.label`.

### Страницы
- `src/pages/Home.tsx` — список книг пользователя.
- `src/pages/Dashboard.tsx` — дашборд книги: heatmap, completion ETA, weekly summary toast.
- `src/pages/Editor.tsx` + `Focus.tsx` + `Split.tsx` — режимы редактирования.
- `src/pages/Corkboard.tsx` — пробковая доска глав.
- `src/pages/Outline.tsx` — структура/конспект глав (pacing visualization).
- `src/pages/Characters.tsx` — картотека персонажей: grid, поиск, фильтры, связи.
- `src/pages/Timeline.tsx` — хронология событий.
- `src/pages/Notes.tsx` — заметки книги.
- `src/pages/Map.tsx` — карта мира.
- `src/pages/Export.tsx` — экспорт: DOCX, EPUB, FB2, HTML.
- `src/pages/Admin.tsx` + `AdminAnalytics.tsx` — AdminOnly: управление пользователями.
- `src/pages/AdminUserDetail.tsx` — карточка пользователя `/admin/users/:id`: книги, история плана, сброс пароля.
- `src/pages/Auth.tsx` — авторизация и регистрация: Telegram, VK ID 2.1, email/пароль; вкладки signin/signup, восстановление пароля.
- `src/pages/Landing.tsx` — публичный лендинг.
- `src/pages/Offer.tsx` — публичная страница оферты `/offer`: тарифы, цены, возврат, акцепт.
- `src/pages/PaymentSuccess.tsx` — страница `/payment-success` после редиректа Робокассы: 3 состояния (`checking` / `success` / `timeout`), поллинг `getProfile` каждые 2с до смены плана или 30с таймаута.

### lib/
- `src/lib/repository.ts` — фабрика `createRepository<T>(table, defaults, orderBy)` → `{ list, create, update, delete }` с единой обработкой ошибок; используется в characters, locations, timeline, connections, notes.
- `src/lib/supabase.ts` — Supabase клиент.
- `src/lib/auth.tsx` — `AuthProvider`, `useAuth`.
- `src/lib/queries.ts` — централизованные React Query хуки (books, chapters, characters, notes…).
- `src/lib/useDebouncedSave.ts` — debounced автосохранение глав.
- `src/lib/useDropdownPosition.ts` — позиционирование дропдаунов (backdrop-паттерн).
- `src/lib/versions.ts` — логика снапшотов/версий.
- `src/lib/pov.ts` — управление POV-записями глав.
- `src/lib/characters.ts` — CRUD персонажей.
- `src/lib/relationships.ts` — единый модуль связей: направленные (`CharacterRelation`, `character_relations`) и двусторонние (`CharacterRelationship`, `character_relationships`, канонический порядок charIdA < charIdB).
- `src/lib/crossrefs.ts` — бэклинки: поиск упоминаний персонажей по главам.
- `src/lib/htmlUtils.ts` — `htmlToText`: конвертация HTML в plain text (единственный канонический экземпляр).
- `src/lib/useChapterVersioning.ts` — хук версионирования главы: session token, interval-снапшоты, chapter_switch, beforeunload-keepalive.
- `src/lib/useCharacterHover.ts` — mousemove 500ms debounce + Unicode-поиск alias персонажа под курсором в TipTap DOM; возвращает `{ shown, onCardEnter, onCardLeave }`.
- `src/lib/useErrorState.ts` — хук error-состояния: `{ error, setError(Error|string), clearError() }`.
- `src/lib/chapterMutations.ts` — helpers обновления кэша React Query после мутаций глав: `updateChapterWithCache`, `createChapterWithCache`, `deleteChapterWithCache`, `invalidateChaptersCache`.
- `src/lib/useResponsive.ts` — `BREAKPOINTS` константы + `useResponsive()` → `{ isMobile, isTablet, isNarrow, isWide }` через matchMedia.
- `src/lib/profiles.ts` — `getProfile(userId)`, `getLifetimeSlotsRemaining()`, `getRegistrationOpen()` (читают `app_settings`), `markOnboarded`, `addWordToDictionary`.
- `src/lib/editorFont.ts` — `EDITOR_FONTS`, `applyEditorFont`, `getStoredEditorFont`; CSS var `--font-editor`; dispatches `as-editor-font` CustomEvent для синхронизации SettingsModal ↔ StatusBar.
- `src/lib/i18n.ts` — `plural(n, one, few, many)` и `pluralDays(n)`: канонические функции русской числовой морфологии.
- `src/lib/useVersionMutations.ts` — `createNamed(content, label)` и `remove(id)`: мутации версий с инвалидацией кеша; скрывает `QUERY_KEYS` и `queryClient` от `VersionsPanel`.
- `src/lib/mapTemplates.ts` — 4 шаблона карты (`parchment`, `sea`, `paper`, `dark`): метаданные для пикера + `renderTemplateBgSvg` для off-screen экспорта.
- `src/lib/mapExport.ts` — `generateMapPngBuffer` (SVG→canvas→PNG) и `triggerMapDownload`; используется из Map.tsx и Export.tsx.
- `src/lib/mapStamps.ts` — `StampType`, `MapStamp`, `STAMP_SVG` (10 типов), `STAMP_LABELS`, `STAMP_BASE_SCALE`; CRUD через `createRepository`; используется в MapStampsLayer, StampPopup, mapExport.
- `src/lib/export.ts` — типы (`Format`, `ParagraphStyle`, `BuildOpts`), константы форматов/языков, shared-утилиты (`escapeHtml`, `escapeXml`, `slugify`, `arrayBufferToBase64`, `scaleToFit`, `triggerDownload`, `downloadText`, `estimateSize`), HTML/TXT/MD builders; реэкспортирует `buildDocxBlob`/`buildFb2Doc`/`buildEpubBlob`.
- `src/lib/exportDocx.ts` — DOCX builder: `collectRuns`, `parseBlockEl`, `parseHtmlToParagraphs`, `buildDocxBlob`.
- `src/lib/exportFb2.ts` — FB2 builder: `inlineToFb2`, `blockToFb2`, `htmlToFb2Content`, `buildFb2Doc`.
- `src/lib/exportEpub.ts` — EPUB builder: `buildEpubBlob`, ZIP-сборка через JSZip.
- `src/lib/config.ts` — централизованные env-константы: `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
- `src/lib/useCharacterFilter.ts` — хук фильтрации персонажей по роли и поисковому запросу; экспортирует тип `RoleFilter`.
- `src/lib/motion.ts` — реестр Framer Motion вариантов и переходов: overlay, modalPanel, page, toast, dropdown, card, hero, feat, reveal.
- `src/lib/repository.test.ts` — unit-тесты `createRepository` (list с лимитом, DbError, create с дефолтами); мокает `./supabase`.
- `src/lib/crossrefs.test.ts` — unit-тесты `extractCharacterMentions`: кириллица, word-boundary lookaround, HTML-стрипинг; без моков.
- `src/lib/queries.test.ts` — тесты стабильности `QUERY_KEYS`: структура, детерминированность, отсутствие коллизий между entity-префиксами.

## Supabase

- Клиент читает `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` из `.env`.
- Миграции: `supabase/migrations/*.sql`. Применять через Supabase MCP (`apply_migration` / `execute_sql`). CLI локально не используется.
- Edge Functions: `supabase/functions/telegram-auth/` — авторизация через Telegram. `supabase/functions/robokassa-webhook/` — вебхук Робокассы: Pro/Lifetime-подписки, декремент lifetime_slots, grandfathered (требует Secrets: `ROBOKASSA_MERCHANT_LOGIN`, `ROBOKASSA_PASSWORD2`, опционально `GRANDFATHERING_ENDS_AT`). `supabase/functions/vk-auth/` — авторизация через VK ID 2.1: верификация access_token, создание пользователя, возврат token_hash.
- **При добавлении таблиц: обязательно RLS** `auth.uid() = user_id` (образец: `0001_init.sql`).
- **При добавлении таблиц: обязательно GRANT** (с 30.10.2026 без него supabase-js не видит таблицу): `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.<table> TO anon, authenticated;`
- Auth URL: `site_url=https://avtorskaya-studiya.vercel.app`, allow-list включает прод + `avtorskaya-studiya-*.vercel.app` + `localhost:5273`.
- Confirm email отключён, регистрация одношаговая.

## Vercel

- Push в `main` → авто-деплой prod.
- `vercel deploy --prod --yes`, `vercel env ls`, `vercel logs`.
- `vercel.json` — SPA-fallback (rewrite всех путей на `/`) — критично для React Router.

## Конвенции

- TypeScript strict, `noUnusedLocals` + `noUnusedParameters` — мёртвый код ломает сборку.
- Без комментариев-шумов. Только для неочевидного.
- Inline-стили допустимы, но при 3+ повторениях — выносить в CSS-класс.
- Импорты относительные (`../components/Icon`). Алиас `@/*` объявлён в `tsconfig.app.json`, пока не используется.
- **Reset-правила в `.as` обёрнуты в `:where()`** — критично для специфичности. Не разворачивать в `.as button`.

### Ownership состояния

- **Серверные данные → React Query.** Не копировать данные из `useQuery` в `useState` для редактирования. Работать с локальным `draft`-состоянием (форма, textarea) отдельно от кэша.
- **UI-состояние → `useState`/`useReducer` локально.** Open/closed, hover, selected index — не поднимать наверх, если не нужно двум несвязанным компонентам.
- **Хранить состояние как можно ниже** по дереву. Поднимать только когда это реально нужно двум несвязанным компонентам.
- **Context** — только для зависимостей, которые пробрасывались бы через 3+ уровня пропов (auth, theme). Не для данных, которые уже есть в React Query.

### Именование

- **Props-обработчики**: `onXxx` (публичный контракт). **Реализации**: `handleXxx` (внутри компонента). Не мешать.
- **Булевые пропы**: префикс `is`/`has`/`can` (`isOpen`, `hasError`, `canEdit`). Исключение: устоявшиеся конвенции React Query (`isLoading`, `isPending`).
- **Хуки**: всегда `use`-префикс. Возвращают объект `{}` если полей > 1. Кортеж `[]` только когда позиция семантически важна (как `useState`).
- **Файлы**: `PascalCase` для компонентов (`CharacterFieldCard.tsx`), `camelCase` для хуков и lib (`useCharacterHover.ts`, `crossrefs.ts`).

### TypeScript — строгость

- **`as` запрещён на внешних данных.** Данные из Supabase типизируются через `Repository<T>`. `as T` допустим только внутри `repository.ts` — единственная точка приведения.
- **`unknown` вместо `any`.** Если тип неизвестен — `unknown` + type guard, не `any`.
- **Discriminated union вместо набора boolean-флагов.** Вместо `isLoading + isError + isEmpty` → `type ViewState = 'loading' | 'error' | 'empty' | 'ready'`.
- **Не экспортировать типы, используемые только в одном файле.** Локальные типы — рядом с использованием, без `export`.

### Производительность

- **`React.memo`** — только когда компонент перерендеривается заметно часто с теми же пропами (item в списке 100+ элементов). Не добавлять превентивно.
- **`useMemo`/`useCallback`** — только для: (1) дорогих вычислений (N > 500 элементов); (2) referential stability при передаче в `React.memo`-дочерний компонент.
- **Не создавать объекты/массивы прямо в JSX** при передаче в мемоизированные компоненты: `style={{ gap: 8 }}` на каждый рендер — новый объект.
- **`React.lazy()`** для тяжёлых страниц (Characters, Timeline, Export, Map) — добавлять при ощутимом росте bundle.

### Доступность (минимум)

- **Кнопки без текста** (иконочные) — обязательно `aria-label`.
- **Модальные окна** — обязателен полный комплект: `role="dialog"` + `aria-modal="true"` + `aria-label="…"` (или `aria-labelledby`) + `tabIndex={-1}` + `useRef` + `useEffect(() => { ref.current?.focus() }, [open])` + `onKeyDown` с Escape-хэндлером + Tab-трап. Шаблон: `ConfirmDialog.tsx` (лучший образец) и `src/pages/Home.tsx` onboarding-модал.
- **Закрытие по `Escape`** — обязательно для всех модалок и дропдаунов.
- **Цветовой контраст** — WCAG AA (4.5:1 для текста). Соблюдать при добавлении новых цветовых сочетаний.

### Правила UI-стилизации

**Визуальное vs лейаут.** Всё, что описывает *как компонент выглядит* (цвет, фон, рамка, типографика, скругления, тени, паддинг внутри компонента) — живёт внутри компонента или его CSS-класса. Снаружи передаётся только то, что описывает *где элемент размещён*: `flex`, `grid`, `gap`, `margin`, позиционирование.

**Cosmetic overrides запрещены.** Нельзя менять внешний вид компонента через `style`, `className` или любую prop снаружи. Если нужен вариант — добавить семантический `variant`/`tone`/`size` prop или модификатор-класс (`--warn`, `--on`, `--primary`) внутри компонента.

**Тест на cosmetic override.** Если убрать `style={{ ... }}` или `className` с вызывающего кода и внешний вид изменится — это косметика, её нельзя держать снаружи.

**Страницы — только композиция.** `src/pages/*` не содержит собственных визуальных определений (цветов, шрифтов, рамок). Только монтирует готовые компоненты, передаёт данные и обрабатывает события.

**Локальные компоненты → `src/components/`.** Если в `.tsx`-странице появляется функция-компонент со своей визуальной логикой — вынести в `src/components/`. Исключение: render-prop заглушки на 2-3 строки.

**CSS-классы вместо inline для повторяющихся паттернов.** Каталог уже содержит:
- `.tb-search` / `.tb-search__input` — поле поиска в тулбаре
- `.char-tabs` / `.char-tab` / `.char-tab--on` — вкладки в детальном виде
- `.toast` / `.toast--error` / `.toast--info` / `.toast--leaving` — уведомления fixed-bottom
- `.input-hint` — вспомогательный текст под полем ввода
- `.char-field-card` + модификаторы — именованная карточка-поле с textarea
- `.btn`, `.btn--primary`, `.btn--ghost`, `.btn--lg`, `.btn--sm`, `.btn--danger-ghost` — кнопки
- `.chip`, `.chip--accent`, `.chip--ok` — теги/статусы
- `.modal-overlay`, `.modal-panel`, `.modal-panel--lg`, `.modal-panel--xl` — модальные окна
- `.label`, `.input`, `.input--sm`, `.input--err` — форм-элементы
- `.error-banner` — баннер ошибки
- `.status-font-item` — кнопка в шрифт-пикере StatusBar
- `.settings-signout-btn` — кнопка «Выйти» в SettingsModal
- `.version-card` / `.version-card--named` — карточка версии в VersionsPanel
- `.map-popup-del` — кнопка удаления в попапе карты

Перед созданием нового inline-стиля — проверить, нет ли подходящего класса в `design-system.css`.

**Hover через CSS, не JS.** Запрещено: `onMouseEnter={(e) => { e.currentTarget.style.X = '...' }}`. Hover-состояние всегда через CSS-класс + `:hover { ... }` в `design-system.css`. Inline `background: 'transparent'` блокирует CSS `:hover` — выносить в класс.

**Без side-stripe.** `border-left` / `border-right` > 1px как цветной акцент на карточках — запрещён. Замена: `background: color-mix(in oklch, VAR 7%, var(--surface))` + `border-color: color-mix(in oklch, VAR 22%, var(--border-soft))`. Образцы: `.mn`, `.version-card--named`, `SortableNoteCard`.

**Near-white — только OKLCH-токен.** Вместо `#fff` или `#ffffff` — всегда `oklch(0.98 0 0)`. Касается цвета текста на `var(--accent)` и `var(--danger)` фонах.

### Паттерны работы с Supabase

- **Всегда использовать `createRepository`** для таблиц с `book_id`. Никаких ручных `.from(table).select('*').eq('book_id', ...)` снаружи `repository.ts`. Исключение: запросы с нестандартными JOIN-ами или `.select('id, content')` (частичная выборка).
- **Никогда `Promise.all(array.map(id => supabase.update(id)))`** для мутаций. Вместо этого — `upsert([...rows])` или `.delete().in('id', ids)`. Один upsert/delete — нормально. Цикл — нет.
- **Ошибки из `createRepository` — это `DbError`** (`src/lib/repository.ts`). При проверке кода ошибки использовать `instanceof DbError` и `err.code`, не `as { code?: string }`.

### Паттерн мутаций React Query

- **`setQueryData` (cache update)** — для мутаций с немедленным эффектом: создание/переименование/удаление. Данные уже известны из ответа сервера. Использовать хелперы из `chapterMutations.ts` как образец для других сущностей.
- **`invalidateQueries`** — когда изменение влияет на вычисляемые поля или смежные данные, которые нужно перезапросить (bulk-операция, ответ без полного объекта).
- **Никогда оба сразу.** `setQueryData` + `invalidateQueries` на одном ключе — двойной рендер и race condition.
- **`onError` в `useMutation`** → всегда вызывать `setError` из `useErrorState`. Не `console.error`, не `alert`.

### Масштабирование — известные ограничения

- **`limit: 500` в listCharacters** — хардкод для текущего масштаба. При росте переходить на cursor-based pagination (Supabase `.range(from, to)` + `useInfiniteQuery`).
- **Индексы** — при создании новой таблицы сразу добавлять индекс на `book_id` и `user_id`. Без индекса RLS-фильтр по `user_id` работает как full-table scan.
- **Новые таблицы с `book_id`** — только через `createRepository`. Прямые `.from(table).select('*')` в компонентах запрещены.

### Паттерны локальности

- **Константы живут рядом с типом.** `ROLE_LABELS`, `ROLE_COLOR`, `TYPE_LABELS`, `TYPE_GLYPHS` — в том файле, где объявлен тип (`characters.ts`, `locations.ts`, `timeline.ts`). Не определять их в компоненте, который первым их использует.

### Антирегрессия UI-компонентов

- **Grep before implement.** Перед написанием любого form-элемента проверить `src/components/` на существующий компонент. Актуальные form-компоненты: `PasswordInput`, `GenrePicker`, `ConfirmDialog`.
- **`type="password"` в JSX страниц запрещён** — только `<PasswordInput />`.
- **Правило двух.** Один и тот же JSX+state-паттерн встречается в двух файлах → немедленно вынести в компонент, не откладывать.
- **Sibling audit.** При добавлении фичи к одной странице домена проверить все сестринские: `Auth.tsx ↔ ResetPassword.tsx`; `Editor.tsx / Focus.tsx / Split.tsx` — всегда вместе; `Characters.tsx ↔` детальный вид персонажа.
- **Реестр компонентов — это `## Архитектура` в CLAUDE.md.** Компонент «не существует» для следующего разработчика/агента, пока не вписан туда. При добавлении нового компонента строка в реестре обязательна.

## Что не трогать

- `_design-source/` — оригинальные .jsx из Cloud Design, референс. Не активный код.
- `src/data/sample.ts` — фоллбэк-данные. Используется в `Chrome.tsx` как заглушка (`NOVEL`, `SAMPLE_PROSE`) когда нет реального контекста книги. Не удалять.

## Windows quirk

`npm.ps1` заблокирован execution policy. Все npm-команды — через **Bash-инструмент**, не PowerShell. Не обходить через `Set-ExecutionPolicy` без явного запроса.

## Token Efficiency Rules

- Никогда не анализировать весь проект без прямого запроса.
- Читать только файлы, относящиеся к текущей задаче.
- Не перечитывать неизменённые файлы без необходимости.
- Делать минимальные diff; предпочитать точечные изменения вместо рефакторингов.
- Не давать длинные объяснения без запроса.
- Перед сканированием большой части проекта уточнять scope.
- Для багфиксов сначала проверять минимальный code path.
- Не анализировать несвязанные папки.

## Workflow Rules

- **Компонент > ~200 строк** — сигнал к аудиту: либо разбить на дочерние компоненты, либо извлечь логику в `useXxx` хук. Хук извлекается, когда: (1) набор `useState`/`useEffect`/`useRef` образует связанный lifecycle; (2) та же логика нужна в двух местах; (3) компонент-хозяин стало трудно читать из-за imperative-кода.
- **Новые фичи не должны ломать существующий функционал.** Перед завершением правки — проверить смежные компоненты и хуки, которые она затрагивает. Например: смена `position: absolute` → `position: fixed` требует аудита предков на `transform`/`filter`/`will-change`, которые создают containing block; перенос `ref` с контейнера на кнопку может сломать хук, читающий геометрию.
- Одна задача за раз, только в рамках текущей feature.
- **При создании или изменении любого UI-компонента читать `docs/design.md`** — цвета, типографику, скроллбары, анимации, компонентные правила. Не изобретать новые токены или паттерны не сверившись с документом.
- Предпочитать изменение существующих компонентов вместо переписывания систем.
- Не создавать лишние абстракции.
- Игнорировать несвязанную архитектуру без необходимости.
- **При изменении кода обновлять `docs/learning-plan.md`**: если добавляется новый компонент, хук, паттерн или значимо меняется существующий файл — обновить соответствующий раздел плана (новые ссылки `файл:строка`, новые задания). Не переписывать план целиком — только точечные правки в затронутых темах.
- **После реализации фикса удалять его из `docs/roadmap.md`**: закрытый баг или выполненная задача немедленно убирается из Активных багов / соответствующего раздела приоритетов. Не оставлять как «выполнено» — просто удалять.
- **При обнаружении нового бага или планируемой фичи — сразу добавлять в `docs/roadmap.md`** в соответствующую зону критичности: если баг блокирует работу или критичен для пользователя — вверх раздела (перед остальными); если некритичен — вниз раздела. Не откладывать и не ждать явного запроса.
- **При запуске `/loop` или любого итеративного цикла** — никогда не превышать запрошенное число итераций и не перезапускать цикл автоматически. Достигнув лимита — остановиться и отчитаться о результатах. Не продолжать без явного разрешения.
- **Перед длинной задачей (> 3 шагов или > 1 файла)** — записывать прогресс в `docs/superpowers/checkpoint.md` после каждого завершённого шага, чтобы можно было возобновить после обрыва сессии. Удалить файл после завершения задачи.
- **Перед широким изменением (рефакторинг, новая абстракция, удаление кода)** — сначала дать ментор-оценку: оправдано ли изменение для этого продукта, какой минимальный скоуп достаточен, в каком одном файле сосредоточена проблема. Не реализовывать без подтверждения пользователя.
- **Периодически запускать `npx knip` и `npm run typecheck`** для проверки мёртвого кода, неиспользуемых экспортов и зависимостей. Инструмент: `knip` (без установки, через `npx`). Делать перед каждым крупным релизом или по явному запросу.
- **После изменений в feature-коде обновлять соответствующий `docs/features/*.md`**: новые поля БД, новые компоненты, новые lib-файлы, deprecated-пометки. Не переписывать целиком — только точечные правки. Цель: быстрая ориентация без чтения исходников.
- **При создании нового файла в `src/components/`, `src/pages/` или `src/lib/` — добавить одну строку в `## Архитектура` в `CLAUDE.md`** с кратким описанием назначения файла. Хук в `.claude/settings.json` напоминает об этом автоматически.

## Скиллы

Канонический источник: `skills-lock.json` + `.agents/skills/` (в репо).
`.claude/skills/` — локальный кэш Claude Code (gitignored, не редактировать вручную).

**Проектные** (`.agents/skills/`):
- `/vercel-react-best-practices` — bundle, lazy loading, производительность React на Vercel
- `/supabase-postgres-best-practices` — RLS, индексы, структура запросов
- `/systematic-debugging` — методология отладки, особенно TipTap + Supabase
- `/improve-codebase-architecture` — анализ и рефакторинг архитектуры компонентов
- `/impeccable` — дизайн-аудит: critique, audit, polish, colorize, typeset (23 команды)
- `/care-refactoring` — прагматичный рефакторинг: discovery → scope proposal → challenge → minimal diff → validation
- `/audit` — 7-категорийный сканер кодовой базы: race conditions, дубли, TS-строгость, React Query, CSS, Supabase. Только отчёт, без автофикса.
- `/ship` — стандартизированный коммит: typecheck → lint → scope confirm → commit → roadmap sync.

**Глобальные** (`~/.claude/skills/`):
- `/gstack` — браузерный агент для QA: скриншоты, тест форм, проверка деплоя (❗ `/browse` не работает — нужен нативный Bun)
- `/ui-ux-pro-max` — справочник UX/UI: 99 правил, 161 палитра, 57 пар шрифтов, Python-поиск по доменам (`--design-system`, `--domain ux/color/typography/chart`, `--stack`). Дополняет `/impeccable` конкретными гайдлайнами.
- `/design-review` — визуальный дизайн-ревью через Playwright MCP: скриншоты desktop/tablet/mobile, аудит типографики, контраста, ритма, иерархии. Использовать когда нужно "увидеть" результат, а не угадывать по коду.

**marketingskills** (`coreyhaines31/marketingskills`, все через `skills-lock.json`):
`/ab-testing`, `/ad-creative`, `/ads`, `/ai-seo`, `/analytics`, `/aso`, `/churn-prevention`, `/co-marketing`, `/cold-email`, `/community-marketing`, `/competitor-profiling`, `/competitors`, `/content-strategy`, `/copy-editing`, `/copywriting`, `/cro`, `/customer-research`, `/directory-submissions`, `/emails`, `/free-tools`, `/image`, `/launch`, `/lead-magnets`, `/marketing-ideas`, `/marketing-psychology`, `/onboarding`, `/paywalls`, `/popups`, `/pricing`, `/product-marketing`, `/programmatic-seo`, `/prospecting`, `/referrals`, `/revops`, `/sales-enablement`, `/schema`, `/seo-audit`, `/signup`, `/site-architecture`, `/sms`, `/social`, `/video`

**Установить позже** (подробности в [docs/roadmap.md](docs/roadmap.md)):
- SEO/GEO — перед публичным запуском
- Frontend Slides — перед питчем/демо
- Expense Tracker Market — при запуске монетизации §3

## Документация (читать по задаче)

Вся документация в `docs/`:

- [docs/roadmap.md](docs/roadmap.md) — активные баги, приоритеты, backlog, продвижение, монетизация.
- [docs/design.md](docs/design.md) — дизайн-система, цвета, типографика, токены.
- [docs/product.md](docs/product.md) — продуктовое описание, планы, монетизация.
- [docs/features/editor.md](docs/features/editor.md) — редактор, TipTap, focus, split.
- [docs/features/characters.md](docs/features/characters.md) — персонажи, связи, chapter_characters.
- [docs/features/timeline.md](docs/features/timeline.md) — хронология.
- [docs/features/maps.md](docs/features/maps.md) — карта мира.
- [docs/features/export.md](docs/features/export.md) — экспорт.
- [docs/features/notes.md](docs/features/notes.md) — заметки книги.
- [docs/learning-plan.md](docs/learning-plan.md) — план изучения TypeScript/React (в .gitignore, личный).
- [docs/email-onboarding.md](docs/email-onboarding.md) — blueprint email-цепочки онбординга (7 писем, тексты, стек). Реализовывать после §2 Робокасса.
- [docs/acquisition.md](docs/acquisition.md) — план привлечения первых пользователей: фазы, площадки, шаблоны сообщений, трекинг.
