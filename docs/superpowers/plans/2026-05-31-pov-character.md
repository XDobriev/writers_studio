# POV-персонаж в главах — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить возможность отмечать POV-персонажа (чьими глазами рассказывается) для каждой главы — видно в списке глав (Outline) и в карточке персонажа.

**Architecture:** Новая колонка `is_pov BOOLEAN` в `chapter_characters` не конфликтует с `auto_detected`; backlinks-удаление фильтруется по `is_pov = false`; цвета персонажей — закрытый набор из 5 oklch-оттенков, вычисляется по индексу.

**Tech Stack:** Supabase (postgres MCP), React + TypeScript, Vite, TanStack Query v5, `src/lib/crossrefs.ts`, `src/pages/Outline.tsx`, `src/pages/Characters.tsx`

---

## Файловая карта

| Файл | Действие | Ответственность |
|---|---|---|
| `supabase/migrations/0022_chapter_pov.sql` | Create | ADD COLUMN is_pov |
| `src/lib/crossrefs.ts` | Modify | Тип + фикс delete |
| `src/lib/pov.ts` | Create | Цвета, setPov, removePov, listBookPovEntries |
| `src/lib/queries.ts` | Modify | useChapterPovMap, QUERY_KEYS |
| `src/styles/design-system.css` | Modify | --character-color-0..4 |
| `src/pages/Outline.tsx` | Modify | POV-бейдж + dropdown в строке главы |
| `src/pages/Characters.tsx` | Modify | ChaptersTab: две секции |

---

## Task 1: Миграция БД

**Files:**
- Create: `supabase/migrations/0022_chapter_pov.sql`

- [ ] **Создать файл миграции**

```sql
-- supabase/migrations/0022_chapter_pov.sql
alter table public.chapter_characters
  add column is_pov boolean not null default false;
```

- [ ] **Применить через Supabase MCP**

Вызвать `mcp__supabase__apply_migration` с name=`0022_chapter_pov` и sql из файла выше.

- [ ] **Проверить в БД**

```sql
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'chapter_characters' and column_name = 'is_pov';
```

Ожидаемый результат: строка с `is_pov`, `boolean`, `false`.

- [ ] **Коммит**

```bash
git add supabase/migrations/0022_chapter_pov.sql
git commit -m "feat(db): add is_pov column to chapter_characters"
```

---

## Task 2: Обновить `crossrefs.ts` — тип и фикс backlinks

**Files:**
- Modify: `src/lib/crossrefs.ts`

**Проблема:** backlinks удаляет строки через `.eq('auto_detected', true)`. Если персонаж был задан как POV и его имя исчезло из текста — backlinks сотрёт POV-запись. Нужно добавить `.eq('is_pov', false)`.

- [ ] **Добавить `is_pov` в `ChapterCharacterRow`**

В `src/lib/crossrefs.ts` найти интерфейс:
```ts
export interface ChapterCharacterRow {
  id: string;
  chapter_id: string;
  character_id: string;
  auto_detected: boolean;
  chapters: { title: string; position: number } | null;
}
```
Заменить на:
```ts
export interface ChapterCharacterRow {
  id: string;
  chapter_id: string;
  character_id: string;
  auto_detected: boolean;
  is_pov: boolean;
  chapters: { title: string; position: number } | null;
}
```

- [ ] **Обновить select в `listChapterCharacters`**

Найти:
```ts
.select('id, chapter_id, character_id, auto_detected, chapters(title, position)')
```
Заменить на:
```ts
.select('id, chapter_id, character_id, auto_detected, is_pov, chapters(title, position)')
```

- [ ] **Защитить POV от удаления backlinks в `syncBacklinks`**

Найти блок delete (строки ~151–156):
```ts
await supabase
  .from('chapter_characters')
  .delete()
  .eq('chapter_id', chapterId)
  .eq('character_id', character.id)
  .eq('auto_detected', true);
```
Заменить на:
```ts
await supabase
  .from('chapter_characters')
  .delete()
  .eq('chapter_id', chapterId)
  .eq('character_id', character.id)
  .eq('auto_detected', true)
  .eq('is_pov', false);
```

- [ ] **То же исправление в `syncCharacterAcrossAllChapters`**

Найти аналогичный delete-блок (строки ~77–83):
```ts
await supabase
  .from('chapter_characters')
  .delete()
  .eq('chapter_id', chapter.id)
  .eq('character_id', character.id)
  .eq('auto_detected', true);
```
Заменить на:
```ts
await supabase
  .from('chapter_characters')
  .delete()
  .eq('chapter_id', chapter.id)
  .eq('character_id', character.id)
  .eq('auto_detected', true)
  .eq('is_pov', false);
```

- [ ] **Проверить типы**

```bash
npm run typecheck
```
Ожидаемый результат: 0 ошибок.

- [ ] **Коммит**

```bash
git add src/lib/crossrefs.ts
git commit -m "fix(backlinks): не удалять POV-записи при обновлении backlinks"
```

---

## Task 3: Создать `src/lib/pov.ts`

**Files:**
- Create: `src/lib/pov.ts`
- Test: `src/lib/pov.test.ts`

- [ ] **Написать падающий тест**

Создать `src/lib/pov.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { getCharacterColor, CHARACTER_COLORS } from './pov';

describe('getCharacterColor', () => {
  it('returns first color for index 0', () => {
    expect(getCharacterColor(0)).toBe(CHARACTER_COLORS[0]);
  });

  it('wraps around at palette length', () => {
    expect(getCharacterColor(5)).toBe(CHARACTER_COLORS[0]);
    expect(getCharacterColor(6)).toBe(CHARACTER_COLORS[1]);
  });

  it('works for large indices', () => {
    expect(getCharacterColor(100)).toBe(CHARACTER_COLORS[100 % CHARACTER_COLORS.length]);
  });
});
```

- [ ] **Запустить тест — убедиться что падает**

```bash
npm run test -- pov.test --run
```
Ожидаемый результат: FAIL (модуль не существует).

- [ ] **Создать `src/lib/pov.ts`**

```ts
import { supabase } from './supabase';

export const CHARACTER_COLORS = [
  'oklch(0.63 0.16 30)',
  'oklch(0.58 0.12 220)',
  'oklch(0.58 0.10 160)',
  'oklch(0.62 0.10 280)',
  'oklch(0.65 0.09 55)',
] as const;

export function getCharacterColor(index: number): string {
  return CHARACTER_COLORS[index % CHARACTER_COLORS.length];
}

export interface PovEntry {
  id: string;
  chapter_id: string;
  character_id: string;
  character_name: string;
  character_index: number;
}

export async function listBookPovEntries(bookId: string): Promise<PovEntry[]> {
  const { data, error } = await supabase
    .from('chapter_characters')
    .select('id, chapter_id, character_id, characters(name, position)')
    .eq('book_id', bookId)
    .eq('is_pov', true);
  if (error) throw error;
  return ((data ?? []) as unknown as Array<{
    id: string;
    chapter_id: string;
    character_id: string;
    characters: { name: string; position: number } | null;
  }>).map((row, i) => ({
    id: row.id,
    chapter_id: row.chapter_id,
    character_id: row.character_id,
    character_name: row.characters?.name ?? '',
    character_index: row.characters?.position ?? i,
  }));
}

export async function setPovCharacter(
  chapterId: string,
  characterId: string,
  bookId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('chapter_characters')
    .upsert(
      { chapter_id: chapterId, character_id: characterId, book_id: bookId, user_id: userId, is_pov: true, auto_detected: false },
      { onConflict: 'chapter_id,character_id' },
    );
  if (error) throw error;
}

export async function removePovCharacter(
  chapterId: string,
  characterId: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from('chapter_characters')
    .select('id, auto_detected')
    .eq('chapter_id', chapterId)
    .eq('character_id', characterId)
    .single();

  if (!existing) return;

  if (existing.auto_detected) {
    await supabase
      .from('chapter_characters')
      .update({ is_pov: false })
      .eq('chapter_id', chapterId)
      .eq('character_id', characterId);
  } else {
    await supabase
      .from('chapter_characters')
      .delete()
      .eq('chapter_id', chapterId)
      .eq('character_id', characterId);
  }
}
```

- [ ] **Запустить тест — должен пройти**

```bash
npm run test -- pov.test --run
```
Ожидаемый результат: 3 теста PASS.

- [ ] **Typecheck**

```bash
npm run typecheck
```
Ожидаемый результат: 0 ошибок.

- [ ] **Коммит**

```bash
git add src/lib/pov.ts src/lib/pov.test.ts
git commit -m "feat(pov): утилиты для управления POV-записями"
```

---

## Task 4: CSS-переменные для цветов персонажей

**Files:**
- Modify: `src/styles/design-system.css`

- [ ] **Добавить переменные в `:root`**

В `src/styles/design-system.css` найти блок `:root {` и добавить после существующих переменных (перед закрывающей `}`):

```css
  /* ── Палитра персонажей (POV-бейджи) ── */
  --character-color-0: oklch(0.63 0.16 30);
  --character-color-1: oklch(0.58 0.12 220);
  --character-color-2: oklch(0.58 0.10 160);
  --character-color-3: oklch(0.62 0.10 280);
  --character-color-4: oklch(0.65 0.09 55);
```

- [ ] **Коммит**

```bash
git add src/styles/design-system.css
git commit -m "feat(design): добавить палитру цветов персонажей"
```

---

## Task 5: Обновить `queries.ts` — хук `useChapterPovMap`

**Files:**
- Modify: `src/lib/queries.ts`

- [ ] **Добавить ключ в `QUERY_KEYS`**

В `src/lib/queries.ts` найти объект `QUERY_KEYS` и добавить:
```ts
chapterPovMap: (bookId: string) => ['chapter-pov-map', bookId] as const,
```

- [ ] **Добавить импорт и хук**

В начало файла добавить импорт:
```ts
import { listBookPovEntries, type PovEntry } from './pov';
```

В конец файла добавить:
```ts
export function useChapterPovMap(bookId: string | undefined) {
  return useQuery<PovEntry[]>({
    queryKey: bookId ? QUERY_KEYS.chapterPovMap(bookId) : ['chapter-pov-map', null],
    queryFn: () => listBookPovEntries(bookId!),
    enabled: !!bookId,
    staleTime: 30_000,
  });
}
```

- [ ] **Typecheck**

```bash
npm run typecheck
```
Ожидаемый результат: 0 ошибок.

- [ ] **Коммит**

```bash
git add src/lib/queries.ts
git commit -m "feat(queries): добавить useChapterPovMap"
```

---

## Task 6: POV-бейдж в `Outline.tsx`

**Files:**
- Modify: `src/pages/Outline.tsx`

Задача разбита на подшаги: сначала компонент бейджа, потом дропдаун, потом интеграция в строку.

- [ ] **Добавить импорты**

В начало `src/pages/Outline.tsx` добавить:
```ts
import { useQueryClient } from '@tanstack/react-query';
import { useCharacters } from '../lib/queries';
import { useChapterPovMap, QUERY_KEYS } from '../lib/queries';
import { getCharacterColor, setPovCharacter, removePovCharacter } from '../lib/pov';
import { useAuth } from '../lib/auth';
```

*(Проверить — некоторые из этих импортов уже могут быть. Дублировать не нужно.)*

- [ ] **Добавить компонент `PovBadge`** (вставить перед `SortableChapterRow`)

```tsx
interface PovBadgeProps {
  chapterId: string;
  bookId: string;
  povEntries: Array<{ character_id: string; character_name: string; character_index: number }>;
  allCharacters: Array<{ id: string; name: string; position: number }>;
  userId: string;
  onChanged: () => void;
}

function PovBadge({ chapterId, bookId, povEntries, allCharacters, userId, onChanged }: PovBadgeProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSet = async (characterId: string) => {
    const char = allCharacters.find((c) => c.id === characterId);
    if (!char) return;
    await setPovCharacter(chapterId, characterId, bookId, userId);
    onChanged();
    setOpen(false);
  };

  const handleRemove = async (characterId: string) => {
    await removePovCharacter(chapterId, characterId);
    onChanged();
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      {povEntries.length === 0 ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            display: 'flex', alignItems: 'center',
            height: 22, padding: '0 8px', borderRadius: 999,
            border: '1px dashed var(--border)', background: 'transparent',
            cursor: 'pointer', font: '500 10px var(--font-mono)',
            color: 'var(--ink-4)', letterSpacing: '0.08em',
          }}
        >
          + POV
        </button>
      ) : povEntries.length === 1 ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            height: 22, padding: '0 8px 0 4px', borderRadius: 999,
            border: `1px solid ${getCharacterColor(povEntries[0].character_index)} `,
            background: `color-mix(in oklch, ${getCharacterColor(povEntries[0].character_index)} 14%, transparent)`,
            cursor: 'pointer',
          }}
        >
          <span style={{
            width: 16, height: 16, borderRadius: '50%',
            background: getCharacterColor(povEntries[0].character_index),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 8, color: 'white', fontWeight: 600, flexShrink: 0,
          }}>
            {povEntries[0].character_name[0]?.toUpperCase() ?? '?'}
          </span>
          <span style={{
            font: '500 10px var(--font-mono)', letterSpacing: '0.03em',
            color: getCharacterColor(povEntries[0].character_index),
          }}>
            {povEntries[0].character_name}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            height: 22, padding: '0 8px 0 4px', borderRadius: 999,
            border: '1px solid var(--border)', background: 'transparent',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex' }}>
            {povEntries.slice(0, 3).map((e, idx) => (
              <span key={e.character_id} style={{
                width: 18, height: 18, borderRadius: '50%',
                background: getCharacterColor(e.character_index),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 8, color: 'white', fontWeight: 600, flexShrink: 0,
                marginLeft: idx > 0 ? -5 : 0,
                border: '2px solid var(--bg-deep)',
              }}>
                {e.character_name[0]?.toUpperCase() ?? '?'}
              </span>
            ))}
          </div>
          <span style={{ font: '500 10px var(--font-mono)', color: 'var(--ink-3)' }}>
            {povEntries.length} POV
          </span>
        </button>
      )}

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 300,
          background: 'var(--bg-deep)', border: '1px solid var(--border-strong)',
          borderRadius: 8, padding: 6, minWidth: 180,
          boxShadow: '0 6px 20px oklch(0.05 0.01 50 / 0.4)',
        }}>
          <div style={{
            font: '500 9px var(--font-mono)', color: 'var(--ink-4)',
            letterSpacing: '0.12em', textTransform: 'uppercase',
            padding: '3px 6px 7px', borderBottom: '1px solid var(--border-soft)',
            marginBottom: 4,
          }}>
            POV персонаж
          </div>
          {allCharacters.map((char, idx) => {
            const isPov = povEntries.some((e) => e.character_id === char.id);
            const color = getCharacterColor(idx);
            return (
              <button
                key={char.id}
                type="button"
                onClick={() => isPov ? handleRemove(char.id) : handleSet(char.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  width: '100%', padding: '5px 6px', borderRadius: 5,
                  background: isPov ? `color-mix(in oklch, ${color} 12%, transparent)` : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{
                  width: 18, height: 18, borderRadius: '50%', background: color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, color: 'white', fontWeight: 600, flexShrink: 0,
                }}>
                  {char.name[0]?.toUpperCase() ?? '?'}
                </span>
                <span style={{ font: '400 12px var(--font-ui)', color: isPov ? color : 'var(--ink-2)', flex: 1 }}>
                  {char.name}
                </span>
                {isPov && (
                  <span style={{ font: '400 10px var(--font-ui)', color: 'var(--ink-4)' }}>✕</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Обновить `RowProps`** — добавить новые пропсы

Найти `interface RowProps` и добавить поля:
```ts
povEntries: Array<{ character_id: string; character_name: string; character_index: number }>;
allCharacters: Array<{ id: string; name: string; position: number }>;
userId: string;
onPovChanged: () => void;
```

- [ ] **Обновить `SortableChapterRow`** — принять и передать новые пропсы

В деструктуризации аргументов `SortableChapterRow` добавить:
```ts
povEntries,
allCharacters,
userId,
onPovChanged,
```

Найти конец строки с Link-элементом (после `</Link>`) и **перед** `<div ref={menuFor...}` вставить:
```tsx
<PovBadge
  chapterId={c.id}
  bookId={bookId}
  povEntries={povEntries}
  allCharacters={allCharacters}
  userId={userId}
  onChanged={onPovChanged}
/>
```

Также уменьшить отступ Link, чтобы уступить место бейджу — найти `padding: '12px 40px 12px 0'` и заменить на `padding: '12px 8px 12px 0'`.

- [ ] **Обновить `OutlinePage`** — загрузить данные и передать в строки

В основном компоненте страницы (найти функцию с `useChapters`) добавить:

```tsx
const { user } = useAuth();
const { data: characters = [] } = useCharacters(bookId);
const { data: povEntries = [], refetch: refetchPov } = useChapterPovMap(bookId);
const queryClient = useQueryClient();

const handlePovChanged = useCallback(() => {
  void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapterPovMap(bookId!) });
}, [queryClient, bookId]);
```

Найти `<SortableChapterRow` в JSX и добавить пропсы:
```tsx
povEntries={povEntries.filter((e) => e.chapter_id === chapter.id)}
allCharacters={characters}
userId={user?.id ?? ''}
onPovChanged={handlePovChanged}
```

*(Если `useCallback` ещё не импортирован — добавить в импорт из `'react'`.)*

- [ ] **Typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Ожидаемый результат: 0 ошибок.

- [ ] **Коммит**

```bash
git add src/pages/Outline.tsx src/lib/queries.ts
git commit -m "feat(outline): POV-бейдж с дропдауном в списке глав"
```

---

## Task 7: Обновить `Characters.tsx` — две секции в ChaptersTab

**Files:**
- Modify: `src/pages/Characters.tsx`

- [ ] **Обновить импорт `crossrefs`**

В `src/pages/Characters.tsx` найти импорт из `'../lib/crossrefs'` и убедиться, что тип `ChapterCharacterRow` также импортируется:
```ts
import { syncCharacterAcrossAllChapters, findNameVariantsInText } from '../lib/crossrefs';
import type { ChapterCharacterRow } from '../lib/crossrefs';
```

- [ ] **Добавить импорт цветовой утилиты**

```ts
import { getCharacterColor } from '../lib/pov';
```

- [ ] **Заменить тело `ChaptersTab`**

Найти всю функцию `ChaptersTab` (строки ~1107–1160) и заменить:

```tsx
function ChaptersTab({ characterId, characterIndex, onNavigate }: {
  characterId: string;
  characterIndex: number;
  onNavigate: (chapterId: string) => void;
}) {
  const { data: rows, isLoading } = useChapterCharacters(characterId);

  if (isLoading) {
    return <div style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-3)' }}>Загрузка…</div>;
  }

  if (!rows || rows.length === 0) {
    return (
      <div style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-3)', padding: '16px 0' }}>
        Персонаж ещё не упомянут ни в одной главе
      </div>
    );
  }

  const povRows = rows.filter((r) => r.is_pov);
  const presentRows = rows.filter((r) => !r.is_pov);
  const color = getCharacterColor(characterIndex);

  const chipStyle = (isPov: boolean): React.CSSProperties => isPov
    ? {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px',
        background: `color-mix(in oklch, ${color} 14%, transparent)`,
        border: `1px solid color-mix(in oklch, ${color} 28%, transparent)`,
        borderRadius: 8, cursor: 'pointer', textAlign: 'left',
        font: '400 13px var(--font-ui)', color, transition: 'opacity 0.15s',
      }
    : {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px',
        background: 'var(--surface)', border: '1px solid var(--border-soft)',
        borderRadius: 8, cursor: 'pointer', textAlign: 'left',
        font: '400 13px var(--font-ui)', color: 'var(--ink)', transition: 'border-color 0.15s, background 0.15s',
      };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {povRows.length > 0 && (
        <div>
          <div style={{
            font: '500 9px var(--font-mono)', color,
            letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6,
          }}>
            POV
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {povRows.map((cc) => (
              <button key={cc.id} type="button" onClick={() => onNavigate(cc.chapter_id)} style={chipStyle(true)}>
                <span>{cc.chapters?.title || 'Без названия'}</span>
                {cc.auto_detected && (
                  <span style={{ font: '400 11px var(--font-ui)', color: `color-mix(in oklch, ${color} 60%, transparent)` }}>(авто)</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {presentRows.length > 0 && (
        <div>
          <div style={{
            font: '500 9px var(--font-mono)', color: 'var(--ink-4)',
            letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6,
          }}>
            Присутствует
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {presentRows.map((cc) => (
              <button
                key={cc.id} type="button" onClick={() => onNavigate(cc.chapter_id)} style={chipStyle(false)}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-soft)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; }}
              >
                <span>{cc.chapters?.title || 'Без названия'}</span>
                {cc.auto_detected && (
                  <span style={{ font: '400 11px var(--font-ui)', color: 'var(--ink-3)' }}>(авто)</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Добавить `characterIndex` в вызов `<ChaptersTab`**

В `src/pages/Characters.tsx` строки ~380–383, найти:
```tsx
<ChaptersTab
  characterId={active.id}
  onNavigate={(chapterId) => navigate(`/books/${bookId}/editor?chapter=${chapterId}`)}
/>
```
Заменить на:
```tsx
<ChaptersTab
  characterId={active.id}
  characterIndex={characters ? characters.findIndex((c) => c.id === active.id) : 0}
  onNavigate={(chapterId) => navigate(`/books/${bookId}/editor?chapter=${chapterId}`)}
/>
```

Использовать `characters.findIndex` (полный список), не `filtered.findIndex` — чтобы цвет персонажа не менялся при поиске.

- [ ] **Typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Ожидаемый результат: 0 ошибок.

- [ ] **Коммит**

```bash
git add src/pages/Characters.tsx src/lib/pov.ts
git commit -m "feat(characters): разбить вкладку Главы на POV и Присутствует"
```

---

## Task 8: Локальная проверка

- [ ] **Запустить dev-сервер**

```bash
npm run dev
```

- [ ] **Сценарий 1 — проставить POV**
  1. Открыть книгу → Структура (Outline)
  2. Рядом с любой главой нажать «+ POV»
  3. Выбрать персонажа из дропдауна
  4. Бейдж должен появиться с именем и аватаркой в цвете

- [ ] **Сценарий 2 — несколько POV**
  1. Для той же главы снова открыть дропдаун
  2. Выбрать второго персонажа
  3. Бейдж должен показать перекрывающиеся аватарки + «2 POV»

- [ ] **Сценарий 3 — убрать POV**
  1. Открыть дропдаун → кликнуть на ✕ рядом с персонажем
  2. Запись должна удалиться

- [ ] **Сценарий 4 — карточка персонажа**
  1. Открыть Персонажи → выбрать персонажа → вкладка «Главы»
  2. Главы с `is_pov = true` отображаются в секции POV (цветные)
  3. Остальные — в «Присутствует» (нейтральные)

- [ ] **Сценарий 5 — backlinks не ломает POV**
  1. Зайти в главу с POV-персонажем
  2. Удалить имя персонажа из текста → подождать автосохранение
  3. Вернуться в Outline → POV-бейдж должен остаться

- [ ] **После проверки — коммит готов**

```bash
git add -u
git commit -m "feat(pov): POV-персонаж в главах — готово к деплою"
```
