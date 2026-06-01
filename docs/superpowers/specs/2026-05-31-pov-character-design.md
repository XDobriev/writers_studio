# POV-персонаж в главах — Дизайн-спек

**Дата:** 2026-05-31
**Статус:** Approved
**Область:** `chapter_characters`, `Outline`, `Characters`

---

## Проблема

Персонаж-протагонист может присутствовать в каждой главе, не называя себя по имени (изолированная локация, внутренний монолог, «камера» от первого лица). Система backlinks не обнаружит такого персонажа. В книгах с несколькими протагонистами нет способа отследить, чьими глазами рассказывается каждая глава.

---

## Модель данных

### Существующая схема `chapter_characters`

Таблица уже имеет `auto_detected BOOLEAN` — флаг, что запись создана backlinks-системой. Backlinks при удалении имени из текста удаляет строки именно через `.eq('auto_detected', true)`.

### Изменение: добавить `is_pov BOOLEAN`

```sql
ALTER TABLE chapter_characters
  ADD COLUMN is_pov BOOLEAN NOT NULL DEFAULT FALSE;
```

**Почему `is_pov`, а не `role` enum:**
- Не конфликтует с `auto_detected` — оба флага независимы
- Запись может быть `auto_detected = true` И `is_pov = true` одновременно (backlinks нашёл персонажа в тексте, и автор пометил его как POV)
- Минимальная миграция без перестройки логики crossrefs

### Семантика

| auto_detected | is_pov | Отображение |
|---|---|---|
| false | false | Присутствует (ручная связь) |
| true | false | Присутствует `(авто)` |
| false | true | POV |
| true | true | POV `(авто)` — backlinks нашёл + автор пометил |

### Критическое изменение в `crossrefs.ts`

Backlinks сейчас удаляет авто-записи так:
```ts
.delete()
.eq('auto_detected', true)
```

После миграции добавить фильтр, чтобы не удалять POV-записи при исчезновении имени из текста:
```ts
.delete()
.eq('auto_detected', true)
.eq('is_pov', false)
```

### Миграция: `0022_chapter_pov.sql`

```sql
ALTER TABLE chapter_characters
  ADD COLUMN is_pov BOOLEAN NOT NULL DEFAULT FALSE;
```

RLS-политики менять не нужно — новое поле покрывается существующими правилами.

---

## UI: список глав (Outline)

### POV-бейдж в строке главы

- **Один POV** — пилюля с аватаркой (инициал) + именем в цвете персонажа
- **Несколько POV** — перекрывающиеся аватарки + «N POV», клик раскрывает список
- **Нет POV** — тихая пунктирная кнопка «+ POV» (низкий контраст)

### Взаимодействие с дропдауном

1. Клик на бейдж / «+ POV» → dropdown с персонажами книги (главные вверху)
2. Выбор персонажа:
   - Если запись `(chapter_id, character_id)` уже есть → `UPDATE is_pov = true`
   - Если нет → `INSERT { is_pov: true, auto_detected: false }`
3. «Убрать POV» → `UPDATE is_pov = false` (строка остаётся если `auto_detected = true` или была ручная связь; иначе DELETE)

### Цветовая палитра персонажей

Каждый персонаж получает цвет из закрытого набора 5 оттенков. Одинаковая хрома oklch (~0.09–0.16) — выглядят как семья.

Добавить в `design-system.css` и `docs/design.md`:

```css
--character-color-0: oklch(0.63 0.16 30);   /* sienna */
--character-color-1: oklch(0.58 0.12 220);  /* slate-blue */
--character-color-2: oklch(0.58 0.10 160);  /* moss-green */
--character-color-3: oklch(0.62 0.10 280);  /* dusk-violet */
--character-color-4: oklch(0.65 0.09 55);   /* amber-warm */
```

Цвет вычисляется по индексу персонажа в отсортированном списке `listCharacters()` (`index % 5`). Хранить в БД не нужно.

---

## UI: карточка персонажа (вкладка «Главы»)

Секция «Появляется в главах» делится на две группы:

### POV (только если `is_pov = true`)
Чипы в акцентном цвете персонажа (`--character-color-N`):
- Фон: `oklch(color / 0.14)`, бордер: `oklch(color / 0.28)`, текст: `color`
- Если POV-записей нет — секция скрыта

### Присутствует
Нейтральные чипы как сейчас (`--oak-surface` фон). `auto_detected = true` — с пометкой `(авто)`.

Клик на любой чип → открывает главу в редакторе (как сейчас).

---

## Что НЕ входит в эту задачу

- Матрица персонажи × главы (отдельный экран)
- «Упомянут» как отдельный тип присутствия
- Автоопределение POV по тексту
- Планировщик «персонаж не появлялся N глав»

---

## Затронутые файлы

| Файл | Изменение |
|---|---|
| `supabase/migrations/0022_chapter_pov.sql` | ADD COLUMN is_pov |
| `src/lib/crossrefs.ts` | Добавить `.eq('is_pov', false)` в delete; обновить тип `ChapterCharacterRow` |
| `src/lib/characters.ts` или новый хелпер | Функции `setPov`, `removePov` для chapter_characters |
| `src/pages/Characters.tsx` | Карточка: две секции в «Главах» + цвет по индексу |
| `src/components/Chrome.tsx` (Outline) | POV-бейдж в строке главы + dropdown |
| `src/styles/design-system.css` | CSS-переменные `--character-color-0..4` |
| `docs/design.md` | Секция «Палитра персонажей» |
