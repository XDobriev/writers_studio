# Feature: Хронология

**Маршрут:** `/books/:id/timeline`

## Компоненты

- `src/pages/Timeline.tsx` — UI.
- `src/lib/timeline.ts` — CRUD событий.

## БД

- Таблица `timeline_events`: поля `era`, `title`, `description`, `type` (plot/character/world/other), `chapter_id` (nullable, on delete set null), `pos`.
- Миграция: `0006_timeline.sql`.

## Функции

- Создание/удаление событий.
- Inline-edit: эра, заголовок, описание, тип, привязка к главе.
- Фильтр по типу в sidebar.
- Вертикальная timeline-лента с цветной шкалой по типу.

## Режимы отображения

Переключатель **Список / Лента** в тулбаре (сохраняется в `localStorage` ключ `timeline-view`).

### Лента (горизонтальная визуализация)

- `TimelineLane` — горизонтальная ось с узлами по `position`.
- `SortableNode` — узел: карточки чередуются выше/ниже оси (`index % 2`), цветной кружок на оси = тип события.
- Drag-and-drop через `@dnd-kit/sortable` (`horizontalListSortingStrategy`). Drag отключён при активном фильтре — в этом случае `useSortable({ disabled: true })`.
- При клике на узел — боковая панель `EventDetailPanel` с полным inline-редактированием (`EventCard`).
- `reorderTimelineEvents` в `timeline.ts` — batch-update `position` для всех событий после drag.
