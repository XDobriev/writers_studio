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
- `src/components/AccountMenu.tsx` — переиспользуемый дропдаун аккаунта (Настройки + Выйти); render-prop `children` для кастомного триггера; `placement="above"|"below"`.
- `src/components/AuthGuard.tsx` — защита роутов.
- `src/components/ErrorBoundary.tsx` — перехват краша компонентов, fallback UI.
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
- `src/pages/Landing.tsx` — публичный лендинг.
- `src/pages/Offer.tsx` — публичная страница оферты `/offer`: тарифы, цены, возврат, акцепт.

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
- `src/lib/useChapterVersioning.ts` — хук версионирования главы: session token, interval-снапшоты, chapter_switch, beforeunload-keepalive.
- `src/lib/useCharacterHover.ts` — mousemove 500ms debounce + Unicode-поиск alias персонажа под курсором в TipTap DOM; возвращает `{ shown, onCardEnter, onCardLeave }`.
- `src/lib/useErrorState.ts` — хук error-состояния: `{ error, setError(Error|string), clearError() }`.
- `src/lib/chapterMutations.ts` — helpers обновления кэша React Query после мутаций глав: `updateChapterWithCache`, `createChapterWithCache`, `deleteChapterWithCache`, `invalidateChaptersCache`.
- `src/lib/useResponsive.ts` — `BREAKPOINTS` константы + `useResponsive()` → `{ isMobile, isTablet, isNarrow }` через matchMedia.
- `src/lib/profiles.ts` — `getProfile(userId)`, `getLifetimeSlotsRemaining()` (читает `app_settings`), `markOnboarded`, `addWordToDictionary`.
- `src/lib/editorFont.ts` — `EDITOR_FONTS`, `applyEditorFont`, `getStoredEditorFont`; CSS var `--font-editor`; dispatches `as-editor-font` CustomEvent для синхронизации SettingsModal ↔ StatusBar.

## Supabase

- Клиент читает `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` из `.env`.
- Миграции: `supabase/migrations/*.sql`. Применять через Supabase MCP (`apply_migration` / `execute_sql`). CLI локально не используется.
- Edge Functions: `supabase/functions/telegram-auth/` — авторизация через Telegram. `supabase/functions/robokassa-webhook/` — вебхук Робокассы: Pro/Lifetime-подписки, декремент lifetime_slots, grandfathered (требует Secrets: `ROBOKASSA_MERCHANT_LOGIN`, `ROBOKASSA_PASSWORD2`, опционально `GRANDFATHERING_ENDS_AT`).
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

### Паттерны работы с Supabase

- **Всегда использовать `createRepository`** для таблиц с `book_id`. Никаких ручных `.from(table).select('*').eq('book_id', ...)` снаружи `repository.ts`. Исключение: запросы с нестандартными JOIN-ами или `.select('id, content')` (частичная выборка).
- **Никогда `Promise.all(array.map(id => supabase.update(id)))`** для мутаций. Вместо этого — `upsert([...rows])` или `.delete().in('id', ids)`. Один upsert/delete — нормально. Цикл — нет.
- **Ошибки из `createRepository` — это `DbError`** (`src/lib/repository.ts`). При проверке кода ошибки использовать `instanceof DbError` и `err.code`, не `as { code?: string }`.

### Паттерны локальности

- **Константы живут рядом с типом.** `ROLE_LABELS`, `ROLE_COLOR`, `TYPE_LABELS`, `TYPE_GLYPHS` — в том файле, где объявлен тип (`characters.ts`, `locations.ts`, `timeline.ts`). Не определять их в компоненте, который первым их использует.

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

- **Новые фичи не должны ломать существующий функционал.** Перед завершением правки — проверить смежные компоненты и хуки, которые она затрагивает. Например: смена `position: absolute` → `position: fixed` требует аудита предков на `transform`/`filter`/`will-change`, которые создают containing block; перенос `ref` с контейнера на кнопку может сломать хук, читающий геометрию.
- Одна задача за раз, только в рамках текущей feature.
- **При создании или изменении любого UI-компонента читать `docs/design.md`** — цвета, типографику, скроллбары, анимации, компонентные правила. Не изобретать новые токены или паттерны не сверившись с документом.
- Предпочитать изменение существующих компонентов вместо переписывания систем.
- Не создавать лишние абстракции.
- Игнорировать несвязанную архитектуру без необходимости.
- **При изменении кода обновлять `docs/learning-plan.md`**: если добавляется новый компонент, хук, паттерн или значимо меняется существующий файл — обновить соответствующий раздел плана (новые ссылки `файл:строка`, новые задания). Не переписывать план целиком — только точечные правки в затронутых темах.
- **После реализации фикса удалять его из `docs/roadmap.md`**: закрытый баг или выполненная задача немедленно убирается из Активных багов / соответствующего раздела приоритетов. Не оставлять как «выполнено» — просто удалять.
- **При обнаружении нового бага или планируемой фичи — сразу добавлять в `docs/roadmap.md`** в соответствующую зону критичности: если баг блокирует работу или критичен для пользователя — вверх раздела (перед остальными); если некритичен — вниз раздела. Не откладывать и не ждать явного запроса.
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

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
