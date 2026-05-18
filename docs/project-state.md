# Project State — Авторская студия

## Заходы (changelog)

- **Заход 1** (2026-05-09): фундамент, авторизация, полка книг.
- **Заход 2** (2026-05-11): редактор → реальный текст глав в Supabase, автосейв debounce 700 мс. `books.words` — триггер `chapters_recount_book_words`. `src/lib/chapters.ts`.
- **Заход 3** (2026-05-11): OAuth. Google работает. Telegram — код есть, кнопка скрыта (anti-fraud). Вернуть: `VITE_TELEGRAM_BOT_USERNAME=authorsStudioBot` в Vercel env.
- **Заход 4** (2026-05-11): персонажи CRUD, таблица `characters` с RLS, автосейв 700 мс. `src/lib/characters.ts`.
- **Заход 5** (2026-05-11): дэшборд книги — реальные stat-карточки, прогресс по цели, последние 6 правок.
- **Заход 6** (2026-05-11): связи персонажей + «появляется в главах». Миграция `0005_relations.sql` — таблицы `character_relations`, `chapter_characters`.
- **Заход 7** (2026-05-11): хронология CRUD, миграция `0006_timeline.sql`, таблица `timeline_events`. `src/lib/timeline.ts`.
- **Заход 8** (2026-05-11): карта мира CRUD, миграция `0007_locations.sql`, таблица `locations`. Grid карточек.
- **Заход 9** (2026-05-11): экспорт HTML/TXT/Markdown без зависимостей. Скачивание через Blob.
- **Заход 10** (2026-05-11): focus-режим (`/books/:id/focus?chapter=X`) — фуллскрин, тёмный фон, ESC.
- **Заход 11** (2026-05-11): split-режим (`/books/:id/split?left=X&right=Y`) — две панели, независимый автосейв.
- **Заход 12** (2026-05-11): миграция на TipTap (ProseMirror). `src/components/RichEditor.tsx`. Bundle 259 KB gzip.
- **Заход 13** (2026-05-11): полноценный тулбар TipTap. `src/components/EditorToolbar.tsx`. Расширения: TextStyle+Color, Highlight, Link, TextAlign, TaskList, Subscript, Superscript. Bundle 263 KB gzip.
- **Фиксы (2026-05-11):** favicon inline SVG; autocomplete на `/login`.

## Текущее состояние

Все экраны на реальных данных. `src/data/sample.ts` — только референс, в активном коде не используется.

- **Заход 14** (2026-05-18): RailNav → реальные инициалы из useAuth; ErrorBoundary подключён ко всем роутам через Guard-обёртку; loading states Characters/Map/Timeline заменены на CSS-спиннер; error-состояния переработаны в centered flex.
- **Заход 15** (2026-05-18): drag-n-drop порядка глав в Outline. `@dnd-kit/core` + `@dnd-kit/sortable`. Оптимистичное обновление TanStack Query. Ручка-иконка `drag` в Icon.tsx. `reorderChapters` в `chapters.ts` — batch-обновление `position` параллельными запросами.
- **Заход 16** (2026-05-18): Фаза 0 — все три критических фикса. `VITE_ADMIN_EMAIL` в env, миграция `0010_admin_rpc_security.sql` (таблица `app_config` + plpgsql-защита RPC), RightPanel → `useNotes()` + `invalidateQueries`.

## Следующие шаги (Заход 16+)

Подробный план — `docs/roadmap.md`.

### Фаза 0 — ЗАКРЫТА ✓

### Фаза 1 — До 10 июня
4. Лендинг `/` — без него нет SEO и конверсии
5. Реальный лимит Free: 1 книга (gate в Home.tsx)
6. Колонка `plan` в профиле пользователя
7. Code splitting (`React.lazy` на маршрутах)
8. Вынести компоненты из Chrome.tsx (820 строк → 5 файлов)
9. Светлая тема
10. Применить миграцию `0008_writing_snapshots.sql` + подключить в Dashboard
11. Онбординг и empty states
12. Meta-теги для лендинга

### После 10 июня — первые пользователи + соавторство
- `book_collaborators` — invite-flow (уровень 2)
- ЮKassa + управление подпиской
- Мобильная версия
- Графическая карта мира, горизонтальная timeline
- DOCX/EPUB экспорт
- Рабочая кнопка Link в тулбаре TipTap (сейчас `window.prompt()`)
