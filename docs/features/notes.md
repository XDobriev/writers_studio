# Feature: Заметки

**Маршрут:** `/books/:id/notes`

## Компоненты

- `src/pages/Notes.tsx` — весь UI, DnD-карточки.
- `src/lib/notes.ts` — CRUD заметок + `reorderNotes`.

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
