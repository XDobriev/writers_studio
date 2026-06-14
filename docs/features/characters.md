# Feature: Персонажи

**Маршрут:** `/books/:id/characters`

## Компоненты

- `src/pages/Characters.tsx` — весь UI, inline-формы связей.
- `src/lib/characters.ts` — CRUD персонажей.
- `src/lib/character_relationships.ts` — CRUD двухсторонних связей.
- `src/lib/crossrefs.ts` — авто-детектирование упоминаний персонажа в тексте глав, синхронизация backlinks, поиск вариантов имени.
- `src/lib/pov.ts` — управление POV-маркером в `chapter_characters`, цвета персонажей.
- `src/lib/useCharacterNavigation.ts` — хук навигации (выбор персонажа, mobile/desktop режимы).
- `src/lib/useCharacterMutations.ts` — мутации через `@tanstack/react-query`.

## БД

- Таблица `characters`. Поля: `name`, `role`, `age`, `quote`, `appearance`, `personality`, `interior_life`, `exterior_life`, `gap`, `backstory`, `notes`, `position`, `avatar_url`, `aliases` (text[]).
- Таблица `character_relationships` — `char_a_id + char_b_id` (каноническое хранение: `char_a_id < char_b_id`), `label_a`, `label_b` (пусто = симметрия), `book_id`. RLS по `user_id`. Миграция: `0020_character_relationships.sql`.
- Таблица `character_relations` — **устаревшая** (директивные связи). Файл `character_relations.ts` существует, но UI не использует. Данные мигрированы в `character_relationships`.
- Таблица `chapter_characters` — many-to-many character ↔ chapter. Поля: `auto_detected: boolean` (проставляется `crossrefs.ts`), `is_pov: boolean`. UNIQUE по `chapter_id,character_id`, on delete cascade.

## Функции

- Список в sidebar с аватаром (или инициалами) и ролью.
- Поиск по имени, фильтр по роли (все / главные / второстеп. / эпиз.).
- Inline-редактирование всех полей с автосейвом debounce 700 мс.
- Смена роли через чипы.
- Удаление с подтверждением (`ConfirmDialog`).
- **Аватар:** загрузка через `<input type="file">`, Storage бакет `character-avatars`, путь `{user_id}/{character_id}`.
- **Псевдонимы (`aliases`):** массив альтернативных имён — используется при авто-детектировании упоминаний.
- **Авто-детектирование упоминаний:** `syncBacklinks` (при сохранении главы) и `syncCharacterAcrossAllChapters` (при изменении имени/псевдонимов) — ищут упоминания через Unicode-aware regex, простанавливают `auto_detected=true`.
- **Поиск вариантов имени:** `findNameVariantsInText` — предлагает похожие слова из текста глав для добавления в aliases.
- **Вкладки карточки:** `info` (поля персонажа) и `chapters` (в каких главах встречается, с POV-маркером).
- **Связи:** двухсторонние через `character_relationships`. Пресеты: «Друг», «Враг», «Родственник». Правка обоих лейблов с debounce, удаление крестиком.
- **POV:** `is_pov` в `chapter_characters`. `setPovCharacter` / `removePovCharacter` из `pov.ts`. Цвета персонажей — 5 oklch-цветов, назначаются по `position % 5`.
- Данные через `@tanstack/react-query` (хуки `useCharacters`, `useRelationships`, `useChapterCharacters`, `useChapterMembers` из `queries.ts`).
- **Персонажи в правой панели редактора:** `RightPanel.tsx` показывает секцию «Персонажи главы» в табе «Заметки» — список персонажей текущей главы с POV-меткой. Данные — `useChapterMembers(chapterId)` → `listChapterMembers` (запрос по `chapter_id`). Добавлен в `crossrefs.ts` рядом с `listChapterCharacters`.
