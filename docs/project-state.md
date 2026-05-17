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

## Следующие шаги (Заход 14+)

- Writing-snapshots для графиков дэшборда — миграция `0008_writing_snapshots.sql` уже в `supabase/migrations/`, нужно применить и подключить.
- Графическая карта мира по координатам.
- Горизонтальная timeline по `pos`.
- DOCX/EPUB экспорт через библиотеки.
- Рабочая кнопка Link в тулбаре TipTap (сейчас `window.prompt()`).
