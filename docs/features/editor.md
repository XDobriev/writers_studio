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

Собственные: `LanguageTool` (орфография), `Hyphenation` (`src/extensions/Hyphenation.ts`) — мягкие переносы (`&shy;`-виджеты, hypher + hyphenation.ru) для justify-текста на листе. Загруженный документ (init и `setContent` целиком — загрузка/смена главы) получает переносы синхронно, в том же кадре; debounce 300 мс — только для набора. Иначе текст сначала рисуется без переносов, а потом все строки перестраиваются.

## Загрузка главы

Метаданные глав приходят раньше контента (`useChapterContent`). Пока `contentReady === false`, `RichEditor` показывает `Skeleton` вместо пустого редактора (иначе видно «Начните писать…» — как будто глава пустая); на листе — `loadingTone="paper"`. Кнопка «Следующая глава» до загрузки скрыта.

## Шрифт редактора

5 шрифтов с поддержкой кириллицы: Source Serif 4 (default), Lora, PT Serif, Spectral, IBM Plex Mono. Все загружены через `@fontsource` npm-пакеты (не CDN).

Пакет `@fontsource-variable/source-serif-4` регистрирует семейство **`'Source Serif 4 Variable'`** (не `'Source Serif 4'`) — стек должен начинаться с него, иначе рисуется Georgia. `applyEditorFont` сразу вызывает `document.fonts.load()`: браузер качает `@font-face` только когда видит текст этим шрифтом, и без предзагрузки подмена шрифта после прихода главы перестраивала бы justify-строки.

Хранится в `localStorage` под ключом `as-editor-font`. CSS-переменная `--font-editor` на `:root` управляет `.sheet` и `.tiptap h1/h2/h3`. Инициализируется в `main.tsx` до рендера (`applyEditorFont(getStoredEditorFont())`).

Два места переключения: **Настройки → Интерфейс** (пиллы + живой предпросмотр на 17px/1.78) и **StatusBar** (кнопка «Aa», попап вверх). Синхронизация между ними — `window.dispatchEvent(new CustomEvent('as-editor-font', { detail: id }))`.

Реализовано в `src/lib/editorFont.ts`.

## Автосохранение

Единая точка — `useChapterAutosave` (`src/lib/useChapterAutosave.ts`), одинаково в `Editor`, `Focus` и `Split`. Debounce 700 мс. Подсчёт слов — `countWords` (начало слова с буквы/цифры, HTML entities `&[a-z0-9#]+;` вычищаются).

**Инварианты (каждый закрывает сценарий потери текста, аудит 2026-10-22):**
- **Очередь по главам.** Патчи копятся в `Map<chapterId, patch>`; переход в другую главу не выбрасывает незаписанный патч прежней, даже если запрос упал.
- **Один запрос в полёте.** Следующий патч уходит только после ответа — старый текст не может лечь в БД после нового, а ответ не может откатить кэш.
- **Ответ сервера не пишется в кэш текста** (`updateChapterMeta` возвращает только метаданные). В метаданные не мержатся поля, которые ещё ждут отправки — заголовок не «прыгает» во время набора.
- **Оптимистичная блокировка.** Сохранение текста идёт с условием `updated_at = <известный>`. 0 строк → главу правили в другом окне/устройстве: их текст сохраняется именованной версией «Из другого окна · ЧЧ:ММ», затем пишется текущий, пользователь видит уведомление. Ничего не теряется.
- **Локальный черновик** (`chapterDrafts.ts`, ключ `as-draft:<id>`) пишется до подтверждения сервером. При открытии главы `useRecoveredChapterContent` сравнивает его с сервером: база совпала → текст восстанавливается и досохраняется («Восстановлен текст, который не успел сохраниться»); база не совпала → черновик уходит в «Версии».
- **Ошибки** — повтор с паузой 1/2/5/10/30 с и сразу по событию `online`; баннер «Последнее изменение ещё не на сервере…» (`UnsavedBanner`).
- **Закрытие вкладки** — при незаписанном тексте нативный диалог «Покинуть сайт?»; keepalive-PATCH (с тем же условием по `updated_at`) в пределах лимита браузера 64 КиБ, всё остальное — в черновике. Keepalive-снимок версии (`useChapterVersioning`) — только для глав до ~24 КБ.

**Посев контента (`contentReady`).** `RichEditor` засеивает `value` один раз на инстанс, когда текст главы загружен; источник — `useRecoveredChapterContent` (сервер или восстановленный черновик).

**Фокус.** Выход по Esc ждёт сохранения (до 3 с), Ctrl+S, версии и бэклинки — как в редакторе. **Сплит.** Данные через React Query (общий кэш со «Студией»), одна глава в обеих панелях запрещена, ошибка записи не заменяет редакторы экраном ошибки.

**Восстановление версии** (`VersionModal`) ждёт `onBeforeRestore` → `autosave.discard(id)` (выбросить незаписанный текст главы и дождаться запроса в полёте), сверяет `version.chapter_id` с текущей главой и после записи передаёт новый `updated_at` через `onRebase`. Горячие клавиши смены главы не работают при открытой модалке.

**Бэклинки** (`syncBacklinks`) — после успешного сохранения текста, по всем персонажам книги (`listMatchableCharacters`, ключ `characters-match`), из `patch.content` именно этой главы. «ё» и «е» в именах не различаются (`makeAliasPattern`); серверный пересчёт при переименовании (`sync_character_chapters`) использует те же правила.

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

`RightPanel` имеет две вкладки: **Заметки** и **Версии**.

- Вкладка «Заметки» — заметки главы + блок «Персонажи главы» (sticky-хедер внутри tabpanel). Персонажи отображаются только когда `chapterId` задан и `chapterMembers.length > 0`.
- Вкладка «Версии» — `VersionsPanel` (lazy-loaded). Логика в `src/lib/versions.ts`, UI — `src/components/VersionsPanel.tsx` + `src/components/VersionModal.tsx`.
- **Секции VersionsPanel:** «Именованные версии» (всегда видна — для Free показывает чип `Pro`, для Pro показывает список или подсказку), авто-снимки по дням.
- **Удаление версии** — через `ConfirmDialog` (промежуточное подтверждение, состояние `deletingId`).
- **VersionModal** — просмотр контента версии, word-diff, восстановление. Полный a11y-набор: `tabIndex={-1}`, focus при открытии, Tab-трап, Escape-хендлер.
- `isPro` передаётся из `EditorHybrid` → `RightPanel` → `VersionsPanel` → `VersionModal`.
