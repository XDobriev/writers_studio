# Feature: Редактор глав

**Маршруты:** `/books/:id/editor`, `/books/:id/focus`, `/books/:id/split`, `/books/:id/outline`, `/books/:id/corkboard`

## Компоненты

- `src/components/EditorHybrid.tsx` — главный редактор, 4 режима: studio / left / right / page.
- `src/components/RichEditor.tsx` — TipTap wrapper (StarterKit + Underline + Placeholder + все расширения).
- `src/components/EditorToolbar.tsx` — полноценный тулбар, `variant="pill"` для режима Страница.
- `src/pages/Focus.tsx` — фуллскрин focus-режим, тёмный фон, ESC → `/editor`.
- `src/pages/Split.tsx` — две панели рядом, независимый автосейв, защита при <2 главах.
- `src/pages/Outline.tsx` — структура/план глав.
- `src/pages/Corkboard.tsx` — карточки глав (пробковая доска).
- `src/lib/chapters.ts` — CRUD глав + `countWords`.

## Хуки EditorHybrid

- `useEditorLayout` — управление режимами (studio/left/right/page), ширина панелей.
- `useKeyboardShortcuts` — горячие клавиши редактора.
- `useMobileDrawers` — управление мобильными drawer'ами (sidebar, правая панель).
- `usePageHint` — подсказка при первом входе в режим Страница.
- `useGoalToast` — toast при достижении дневной цели по словам.
- `useWritingStats` — `todayWords`, `streak` для статусной плашки.

## TipTap расширения

TextStyle, Color, Highlight (multicolor), Link, TextAlign (heading+paragraph), TaskList, TaskItem, Subscript, Superscript, StarterKit, Underline, Placeholder.

## Автосохранение

Debounce 700 мс через `chapters.ts`. Подсчёт слов — `countWords` требует начало слова с буквы/цифры (одиночные `-` и `'` не считаются). Очистка HTML entities: `&[a-z0-9#]+;`.

## Пользовательский словарь (§11)

`addWordToDictionary` из `profiles.ts` — добавляет слово в `profiles.custom_dictionary` (text[]). Передаётся в `RichEditor` через проп `userDictionary` + колбэк `onAddWord`.

## Тулбар — группы кнопок

Undo/Redo · Heading dropdown (Обычный/H1/H2/H3) · B/I/U/Strike/Clear · Color/Highlight popovers · Sup/Sub · Align (L/C/R/Justify) · BulletList/OrderedList/TaskList · Quote/Code/CodeBlock/HR · Link/Unlink · ModeSegment.

Color открывает popover (9 цветов + сброс), Highlight — 7 цветов + сброс. Link — inline-попover: поле ввода URL, кнопки «Применить» / «Открыть» / «Убрать», Enter подтверждает, Escape закрывает.

## CSS

`.tiptap` блок в `src/styles/design-system.css`. `.sheet .tiptap` с `!important` перебивают inline color из старого HTML в БД. `overflow-x: auto` на тулбаре.

## Sidebar в режиме Манускрипт

Навигационные пункты рендерятся как `<Link>` с реальными путями `/books/:id/characters`, `/books/:id/map`, `/books/:id/timeline`, `/books/:id`. Если `bid` не определён — пункты задизейблены (`opacity: 0.5, cursor: default`).

## Focus Mode (§R6)

Режим затемнения абзацев при письме. Тоггл-кнопка в `StatusBar` (иконка crosshair, только на desktop). При включении:
- `<main className="focus-mode">` в `EditorHybrid`
- CSS: `.focus-mode .sheet .tiptap p/li/h1/h2/h3/blockquote { opacity: 0.38 }`, активный абзац (`.has-focus`) — `opacity: 1`
- `@tiptap/extension-focus` добавляет класс `has-focus` на узел с курсором (`mode: 'shallowest'`)
- Заголовок главы `.sheet-title` тоже приглушается до 0.38, полная яркость при `:focus`
- Состояние не персистируется (сбрасывается при перезагрузке)

## Статусная плашка

Реальные данные: слова и знаки из активной главы, `todayWords` и `streak` из `writingStats` (хук в `EditorHybrid`). При `!isReal` (демо-режим) рендерится `<StatusBar />` с дефолтами.

## История версий (правая панель)

`RightPanel` имеет две вкладки: **Заметки** и **Резервные копии / История версий**.

- Вкладка «Резервные копии» (Free) — автоснимки через `chapter_versions` в Supabase. Логика в `src/lib/versions.ts`, UI — `src/components/VersionsPanel.tsx` + `src/components/VersionModal.tsx`.
- Вкладка «История версий» (Pro) — ручные снимки с метками.
- Восстановление версии применяет контент через `editor.commands.setContent()`.
- `isPro` передаётся из `EditorHybrid` → `RightPanel` → `VersionsPanel`.
