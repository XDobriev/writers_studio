# Feature: Редактор глав

**Маршруты:** `/books/:id/editor`, `/books/:id/focus`, `/books/:id/split`, `/books/:id/outline`, `/books/:id/corkboard`

## Компоненты

- `src/components/EditorHybrid.tsx` — главный редактор, 4 режима: studio / left / right / page.
- `src/components/RichEditor.tsx` — TipTap wrapper (StarterKit + Underline + Placeholder + все расширения из Захода 13).
- `src/components/EditorToolbar.tsx` — полноценный тулбар, `variant="pill"` для режима Страница.
- `src/pages/Focus.tsx` — фуллскрин focus-режим, тёмный фон, ESC → `/editor`.
- `src/pages/Split.tsx` — две панели рядом, независимый автосейв, защита при <2 главах.
- `src/lib/chapters.ts` — CRUD глав + `countWords`.

## TipTap расширения (Заход 13)

TextStyle, Color, Highlight (multicolor), Link, TextAlign (heading+paragraph), TaskList, TaskItem, Subscript, Superscript, StarterKit, Underline, Placeholder.

## Автосохранение

Debounce 700 мс через `chapters.ts`. Подсчёт слов — `countWords` требует начало слова с буквы/цифры (одиночные `-` и `'` не считаются). Очистка HTML entities: `&[a-z0-9#]+;`.

## Тулбар — группы кнопок

Undo/Redo · Heading dropdown (Обычный/H1/H2/H3) · B/I/U/Strike/Clear · Color/Highlight popovers · Sup/Sub · Align (L/C/R/Justify) · BulletList/OrderedList/TaskList · Quote/Code/CodeBlock/HR · Link/Unlink · ModeSegment.

Color открывает popover (9 цветов + сброс), Highlight — 7 цветов + сброс. Link — inline-попover: поле ввода URL, кнопки «Применить» / «Открыть» / «Убрать», Enter подтверждает, Escape закрывает.

## CSS

`.tiptap` блок в `src/styles/design-system.css`. `.sheet .tiptap` с `!important` перебивают inline color из старого HTML в БД. `overflow-x: auto` на тулбаре.

## Sidebar в режиме Манускрипт

**Баг #4** — навигационные пункты не кликабельны. Должно роутить на `/books/:id/characters`, `/books/:id/map`, `/books/:id/timeline`, `/books/:id`.

## Статусная плашка

**Баг #5** — «Сегодня · 348/1000 слов · серия 7 дней» — фейк из `SAMPLE_PROSE`. Нужна таблица `writing_snapshots` (миграция `0008` готова).

## Bundle

263 KB gzip (после Захода 13). До TipTap было 138 KB.
