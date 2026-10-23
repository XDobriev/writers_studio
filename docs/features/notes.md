# Feature: Заметки

**Маршрут:** `/books/:id/notes`

## Компоненты

- `src/pages/Notes.tsx` — UI: поиск, форма создания, DnD-карточки.
- `src/lib/notes.ts` — CRUD заметок + `reorderNotes`.
- `src/lib/useNoteMutations.ts` — mutation-хук: `onAdd`, `onUpdate`, `onDelete`, `onReorder` + `isSaving`. Единственный путь мутаций заметок — и для `Notes.tsx`, и для `RightPanel` (панель передаёт `chapterId` в `onAdd`).
- `src/lib/useCreateOnMount.ts` — хук «создать сразу при переходе» (`?create=true` в URL).
- `src/components/RightPanel.tsx` — заметки главы в правой панели редактора. Добавление: «+» в шапке, CTA в пустом состоянии и пунктирная кнопка `.rp-add-note` под списком, когда заметки уже есть и ни одна не открыта на создание/редактирование.
- `src/lib/useAutoResize.ts` — авторост полей ввода заметок (`.input--textarea`): от `rows` до 240px, дальше прокрутка внутри поля. Во всех 4 полях: создание/редактирование в панели и на странице.

## БД

- Таблица `notes`. Поля: `id`, `user_id`, `book_id`, `chapter_id` (nullable, привязка к главе), `kind`, `text`, `custom_label`, `custom_color`, `position`, `created_at`.

## Виды заметок (`NoteKind`)

`idea | question | todo | important | custom`

- `custom` — пользовательский вид: произвольный `custom_label` и `custom_color` (одно из базовых значений NoteKind как ключ к CSS-переменной).

## CSS-переменные цветов

`--note-idea`, `--note-question`, `--note-todo`, `--note-important` (и `-soft` варианты для фона).

## Функции

- Создание заметки с выбором вида.
- Inline-редактирование текста.
- Привязка к главе через `chapter_id`.
- Drag-and-drop сортировка через `@dnd-kit/sortable` (`rectSortingStrategy`). После drop — batch-update `position` через `reorderNotes`.
- Удаление с подтверждением (`ConfirmDialog`).
- Данные через `@tanstack/react-query` (хук `useNotes` из `queries.ts`).
