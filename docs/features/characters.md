# Feature: Персонажи

**Маршрут:** `/books/:id/characters`

## Компоненты

- `src/pages/Characters.tsx` — весь UI, inline-формы связей.
- `src/lib/characters.ts` — CRUD персонажей, связей, chapter_characters.

## БД

- Таблица `characters` с RLS (`auth.uid() = user_id`). Поля: `name`, `role`, `age`, `quote`, `appearance`, `personality`, `backstory`, `notes`.
- Таблица `character_relations` — `from_id → to_id + label`, UNIQUE, CHECK no-self, on delete cascade.
- Таблица `chapter_characters` — many-to-many character ↔ chapter, UNIQUE, on delete cascade.
- Миграция: `0005_relations.sql`.

## Функции

- Список в sidebar с инициалами и ролью.
- Поиск по имени, фильтр по роли (все / главные / второстеп. / эпиз.).
- Inline-редактирование всех полей с автосейвом debounce 700 мс.
- Смена роли через чипы.
- Удаление с подтверждением.
- **Связи:** inline-форма (выбор персонажа + ярлык), правка ярлыка с debounce, удаление крестиком. Направление `from → to`.
- **Появляется в главах:** chip-сетка всех глав, клик тогл-ит привязку.
