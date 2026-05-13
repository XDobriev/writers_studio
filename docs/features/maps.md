# Feature: Карта мира

**Маршрут:** `/books/:id/map`

## Компоненты

- `src/pages/Map.tsx` — UI.
- (нет отдельного lib-файла, запросы в компоненте).

## БД

- Таблица `locations`: поля `type` (city/village/forest/sea/castle/other), `name`, `role`, `description`, `x` (nullable), `y` (nullable).
- Миграция: `0007_locations.sql`.

## Функции

- Создание/удаление локаций.
- Inline-edit: тип, имя, роль, описание.
- Фильтр по типу в sidebar.
- Grid карточек.

## Следующий шаг

Графическая карта с пинами по координатам `x/y`.
