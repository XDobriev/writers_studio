# Feature: Персонажи

**Маршрут:** `/books/:id/characters`

## Компоненты

- `src/pages/Characters.tsx` — весь UI, inline-формы связей.
- `src/lib/characters.ts` — CRUD персонажей, связей, chapter_characters.

## БД

- Таблица `characters` с RLS (`auth.uid() = user_id`). Поля: `name`, `role`, `age`, `quote`, `appearance`, `personality`, `backstory`, `notes`.
- Таблица `character_relationships` — `char_a_id + char_b_id` (каноническое хранение: `char_a_id < char_b_id`), `label_a` (как A видит B), `label_b` (как B видит A, пусто = симметрия), `book_id`. RLS по `user_id`. Миграция: `0020_character_relationships.sql`.
- Таблица `character_relations` — устаревшая (директивные связи). Данные мигрированы в `character_relationships`. Не используется в UI.
- Таблица `chapter_characters` — many-to-many character ↔ chapter, UNIQUE, on delete cascade.
- Миграция: `0005_relations.sql`.

## Функции

- Список в sidebar с аватаром (или инициалами) и ролью.
- Поиск по имени, фильтр по роли (все / главные / второстеп. / эпиз.).
- Inline-редактирование всех полей с автосейвом debounce 700 мс.
- Смена роли через чипы.
- Удаление с подтверждением.
- **Аватар:** загрузка через `<input type="file">`, хранится в Storage бакете `character-avatars`, путь `{user_id}/{character_id}`. Поле `avatar_url` в таблице `characters`. Отображается в sidebar и в карточке связи.
- **Связи:** двухсторонние. Форма: выбор персонажа + «Как вы видите их» + опциональное «Как они видят вас» (пусто = взаимная). Пресеты: «Друг», «Враг», «Родственник». В карточке B автоматически отображается обратная связь с меткой `(взаимная)` если `label_b` пуст. Правка обоих лейблов с debounce 700 мс, удаление крестиком.
- **Появляется в главах:** chip-сетка всех глав, клик тогл-ит привязку.
