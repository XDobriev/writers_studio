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

## Следующий шаг

Горизонтальная timeline-визуализация по полю `pos`.
