# Авторская студия — заметки для Claude Code

Редактор для писателей. Vite + React + TypeScript на фронте, Supabase (Auth + Postgres) на бэке, деплой на Vercel.

## Боевые ссылки

- **Прод:** https://avtorskaya-studiya.vercel.app
- **GitHub:** https://github.com/XDobriev/writers_studio (push в `main` авто-деплоится в Vercel)
- **Supabase project ref:** `joaxeoavjvlqmtlepkrr` (Dashboard: https://supabase.com/dashboard/project/joaxeoavjvlqmtlepkrr)
- **Vercel project:** `khamza-s-projects/avtorskaya-studiya`
- **Supabase MCP** подключён в local scope (`~/.claude.json`) с `--project-ref=joaxeoavjvlqmtlepkrr`. Для выполнения SQL/инспекции БД грузить tools через ToolSearch `select:mcp__supabase__...`.

## Текущая стадия

- **Заход 1** (в проде 2026-05-09): фундамент, реальная авторизация, реальная полка книг.
- **Заход 2** (в проде 2026-05-11): редактор пишет реальный текст глав в Supabase с автосохранением (debounce 700 мс). Главы — CRUD (создание/переименование/контент через `src/lib/chapters.ts`). Outline и Corkboard читают те же данные. `books.words` пересчитывается триггером `chapters_recount_book_words` из суммы `chapters.words`. Сцены и порядок drag-n-drop — позже.
- **Заход 3** (в проде 2026-05-11): OAuth. Google работает end-to-end. Telegram-код и Edge Function `telegram-auth` на месте, но кнопка скрыта — Telegram anti-fraud режет login challenge для свежего бота. Вернуть = добавить `VITE_TELEGRAM_BOT_USERNAME=authorsStudioBot` в Vercel env.
- **Заход 4** (в проде 2026-05-11): персонажи — реальный CRUD в Supabase. Таблица `characters` с RLS, поля name/role/age/quote/appearance/personality/backstory/notes, автосохранение полей с debounce 700 мс через `src/lib/characters.ts`.
- **Заход 5** (в проде 2026-05-11): дэшборд книги (`/books/:id`) — реальные карточки (слова/главы/персонажи/дни в работе), прогресс по цели, список последних 6 правок. Графики до писательских снимков отложены — плашка-плейсхолдер.
- **Заход 6** (в проде 2026-05-11): связи между персонажами + «появляется в главах». Миграция `0005_relations.sql` — таблицы `character_relations` (from→to + label, UNIQUE, CHECK no-self) и `chapter_characters` (many-to-many, UNIQUE). Inline-формы в `src/pages/Characters.tsx`, debounce 700 мс на label связи. Каскадные удаления через FK on delete cascade.
- **Точность подсчёта слов**: в `src/lib/chapters.ts` `countWords` теперь требует чтобы слово начиналось с буквы/цифры (одиночные `-` и `'` не считаются). Очистка HTML entities расширена до `&[a-z0-9#]+;`. Для уже сохранённых глав счётчики пересчитаются при следующей правке.

Дальше:
- **Заход 7+** — хронология, карта, focus/split/export, writing-snapshots для дэшборда.

Демо-экраны (карта, хронология, focus, split, export) пока рендерятся на демо-данных из `src/data/sample.ts`. Персонажи и дэшборд переехали на реальные данные.

## Готовые функции для пользовательской проверки

Чеклист того, что уже реально работает в проде — пользователь проверяет, находит баги, репортит. Найденные баги записываются в подраздел ниже.

**Auth (`/login`)**
- Регистрация по email/паролю (одношаговая, без подтверждения).
- Вход по email/паролю.
- Вход через Google OAuth (полный flow).
- Выход (кнопка «Выйти» в `/books`).
- Защита маршрутов: незалогиненного редиректит на `/login` с return-state.

**Полка книг (`/books`)**
- Список книг текущего пользователя (только свои — RLS).
- Создание книги (название, жанр, цель по словам).
- Открытие книги → переход на `/books/:id` (дэшборд).
- Прогресс по словам пересчитывается из глав (триггер `chapters_recount_book_words`).

**Дэшборд книги (`/books/:id`)**
- 4 stat-карточки на реальных данных: слова/главы/персонажи/дни в работе.
- Прогресс по цели (procент + сколько слов осталось).
- Список последних 6 правок (клик → редактор конкретной главы).
- Боковое меню навигации между разделами книги.

**Редактор глав (`/books/:id/editor`)**
- Список глав в sidebar.
- Создание главы.
- Переименование главы (inline).
- Редактирование текста с автосохранением (debounce 700 мс).
- Подсчёт слов на лету.
- Outline и Corkboard читают те же главы (`/books/:id/outline`, `/books/:id/corkboard`).
- Переключение режимов студия/левая/правая/страница.

**Персонажи (`/books/:id/characters`)**
- Список персонажей в sidebar с инициалами и ролью.
- Поиск по имени.
- Фильтр по роли (все / главные / второстеп. / эпиз.).
- Создание персонажа (кнопка «Новый персонаж» / «Создать первого»).
- Inline-редактирование с автосохранением: имя, возраст, цитата, внешность, характер, предыстория, заметки.
- Смена роли через чипы.
- Удаление с подтверждением.
- Навигация в sidebar на Дэшборд/Манускрипт/Карта/Хронология.
- **Связи** (between characters): inline-форма добавления (выбор персонажа + текст ярлыка), правка ярлыка с debounce, удаление крестиком. Каждая связь направлена `from → to`.
- **Появляется в главах**: chip-сетка всех глав, клик тогл-ит привязку character ↔ chapter.

**Карта / Хронология / Focus / Split / Export** — демо, не в проверке.

### Найденные баги

*(пусто — пользователь сообщит)*

## Что не трогать

- `_design-source/` — оригинальные .jsx из Cloud Design, сохранены как референс. Это не активный код, не редактировать и не пересобирать на их основе. При расхождении правда в `src/`.
- `src/data/sample.ts` дублирует то, что было в `_design-source/content.js` — для макетных экранов. По мере перевода экранов на реальные данные эта зависимость будет уходить.

## Команды

- `npm run dev` — dev-сервер на 127.0.0.1:5273 (5173 занят параллельным проектом «Авторская студия версия 1» — не нашим)
- `npm run build` — продакшен-сборка в `dist/`
- `npm run typecheck` — только TypeScript, без сборки
- `npm run preview` — превью продакшен-сборки


## Windows quirk

`npm.ps1` заблокирован execution policy на этой машине — запуск `npm` через PowerShell-инструмент падает с PSSecurityException. Использовать **Bash-инструмент** для всех npm-команд (там npm запускается напрямую, не через .ps1-обёртку). Не пытаться обходить через `Set-ExecutionPolicy` без явного запроса пользователя.

## Supabase

- Клиент: `src/lib/supabase.ts`. Читает `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` из `.env`. На Vercel те же переменные лежат в Production+Development environments.
- Auth: `src/lib/auth.tsx` (`AuthProvider`, `useAuth`). Защита роутов — `<AuthGuard>` в `src/components/AuthGuard.tsx`. Confirm email отключён, регистрация одношаговая.
- Миграции: `supabase/migrations/*.sql`. Применяются через Supabase MCP (`apply_migration`/`execute_sql`) или Management API через PAT. Локально CLI Supabase не используется.
- При добавлении таблиц обязательно RLS-политики `auth.uid() = user_id` (см. `0001_init.sql` как образец).
- Auth URL Configuration уже настроена: `site_url=https://avtorskaya-studiya.vercel.app`, allow-list включает прод, preview-домены `avtorskaya-studiya-*.vercel.app` и `localhost:5273`.

## Vercel

- Проект `khamza-s-projects/avtorskaya-studiya`, привязан к GitHub репо. Push в `main` → авто-деплой prod.
- Vercel CLI в PATH, `vercel whoami` = `xdobriev`. Команды: `vercel deploy --prod --yes`, `vercel env ls`, `vercel logs`.
- Для слэш-команд Claude Code загружен пакет vercel-плагинов: `/vercel:deploy`, `/vercel:env`, `/vercel:status`.
- `vercel.json` настраивает SPA-fallback (rewrite всех путей на `/`) — важно для React Router.

## Архитектура коротко

- `src/App.tsx` — роутер. Все рабочие маршруты — `/books/:id/...` под `<AuthGuard>`.
- `src/components/Chrome.tsx` — Sidebar, Toolbar, RightPanel, RailNav, WithMode, StatusBar, Sheet. Все используют `NOVEL`/`SAMPLE_PROSE` из `src/data/sample.ts` — при переводе на реальные данные начинать здесь.
- `src/components/EditorHybrid.tsx` — главный редактор, четыре режима (studio/left/right/page).
- `src/styles/design-system.css` — все CSS-переменные (oklch-палитра, шрифты, радиусы). Кастомные классы `.as`, `.sb`, `.tb`, `.sheet`, `.btn`, `.input`, `.label` и др. описаны там же. Inline-стили в JSX оставлены из дизайна — постепенно переезжают в CSS-классы по мере появления повторений.
- **Reset-правила в `.as` обёрнуты в `:where()`** (`.as :where(button)`, `.as :where(input)` и т.д.) — это критично, иначе они побивают утилитарные классы вроде `.btn--primary` по специфичности. Не разворачивать обратно в `.as button`.

## Конвенции

- TypeScript strict, `noUnusedLocals` + `noUnusedParameters` включены — мёртвый код ломает сборку.
- Без комментариев-шумов («// сохраняет книгу»). Комментарии только для неочевидного.
- Inline-стили допустимы (всё ещё много дизайн-кода), но при появлении третьего повторения — выносить в CSS-класс.
- Пути импортов относительные (`../components/Icon`). Алиас `@/*` объявлен в `tsconfig.app.json`, но пока не используется — можно ввести при реальной потребности.
