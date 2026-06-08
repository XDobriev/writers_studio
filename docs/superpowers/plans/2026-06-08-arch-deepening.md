# Architecture Deepening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> ⚠️ **Статус на 2026-06-08:** Tasks 1–4 уже реализованы в кодовой базе. Выполнять только **Task 5** (ADR). Подробности: `src/lib/i18n.ts` ✅, `useWindowWidth.ts` удалён ✅, `useCharacterMutations` использует `useQueryClient()` внутри ✅, `useVersionMutations.ts` существует ✅.

**Goal:** Устранить 5 точек архитектурного трения: дублирование `plural`, два источника responsive-состояния, лишний параметр `queryClient` в `useCharacterMutations`, ручная инвалидация кеша в `VersionsPanel`, и отсутствие явного ADR для shallow-прокси модулей.

**Architecture:** Каждое изменение — самостоятельная атомарная правка: создать один канонический модуль / убрать дублирование / упростить интерфейс хука. Ни одно изменение не требует предыдущего. Порядок: от безопасного к рискованному.

**Tech Stack:** TypeScript 5, React 18, Vite, React Query v5, TipTap

---

## Task 1: Канонический модуль plural — `src/lib/i18n.ts`

**Files:**
- Create: `src/lib/i18n.ts`
- Modify: `src/lib/useWritingStats.ts` (строки 10–22 — убрать определения, добавить re-export)
- Modify: `src/components/EditorHybrid.tsx` (строки 40–46 — убрать локальную функцию)
- Modify: `src/pages/Home.tsx` (строки 20–27 — убрать локальную функцию)
- Modify: `src/components/StatusBar.tsx` (строки 225–230 — убрать локальный `pluralDays`)

**Контекст.** `plural()` определена в 3 местах (`useWritingStats.ts`, `EditorHybrid.tsx`, `Home.tsx`) с чуть разным порядком проверок, но одинаковым результатом. `pluralDays()` — в `useWritingStats.ts` и `StatusBar.tsx`. Цель: единая реализация в `i18n.ts`; `useWritingStats.ts` re-exportит, так что все текущие импортёры (Dashboard, Corkboard, Outline) не меняются.

- [ ] **Step 1: Создать `src/lib/i18n.ts`**

```typescript
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export function pluralDays(n: number): string {
  return plural(n, 'день', 'дня', 'дней');
}
```

- [ ] **Step 2: Обновить `useWritingStats.ts` — убрать определения, добавить re-export**

Найти и удалить строки 10–22:
```typescript
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

function pluralDays(n: number): string {
  return plural(n, 'день', 'дня', 'дней');
}

export { pluralDays };
```

Добавить в начало файла (после существующих imports):
```typescript
export { plural, pluralDays } from './i18n';
```

- [ ] **Step 3: Обновить `EditorHybrid.tsx` — убрать локальную функцию, добавить импорт**

Удалить строки 40–46:
```typescript
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
```

Добавить к существующим imports:
```typescript
import { plural } from '../lib/i18n';
```

- [ ] **Step 4: Обновить `Home.tsx` — убрать локальную функцию, добавить импорт**

Удалить строки 20–27:
```typescript
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
```

Добавить к существующим imports:
```typescript
import { plural } from '../lib/i18n';
```

- [ ] **Step 5: Обновить `StatusBar.tsx` — убрать локальный `pluralDays`, добавить импорт**

Удалить строки 225–230 (внутри функции-компонента):
```typescript
function pluralDays(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'день';
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'дня';
  return 'дней';
}
```

Добавить к существующим imports:
```typescript
import { pluralDays } from '../lib/i18n';
```

- [ ] **Step 6: Проверка типов и линтер**

```bash
npm run typecheck
npm run lint
```

Ожидаемый результат: 0 ошибок.

- [ ] **Step 7: Commit**

```bash
git add src/lib/i18n.ts src/lib/useWritingStats.ts src/components/EditorHybrid.tsx src/pages/Home.tsx src/components/StatusBar.tsx
git commit -m "refactor(i18n): вынести plural/pluralDays в src/lib/i18n.ts"
```

---

## Task 2: Единый источник responsive — убрать `useWindowWidth`

**Files:**
- Modify: `src/lib/useResponsive.ts` (добавить `isWide`)
- Modify: `src/lib/useEditorLayout.ts` (заменить `useWindowWidth` на `useResponsive`)
- Delete: `src/lib/useWindowWidth.ts`

**Контекст.** `useWindowWidth` — единственный потребитель в `useEditorLayout.ts`. `useEditorLayout` нужно единственное дополнительное состояние сверх `useResponsive` — `isWide` (для показа правой панели). Добавляем его в `useResponsive`, мигрируем `useEditorLayout`, удаляем `useWindowWidth.ts`.

- [ ] **Step 1: Добавить `isWide` в `useResponsive.ts`**

Изменить функцию `useResponsive`:
```typescript
export function useResponsive() {
  const isMobile = useMediaQuery(`(max-width: ${BREAKPOINTS.MOBILE - 1}px)`);
  const isTablet = useMediaQuery(`(max-width: ${BREAKPOINTS.TABLET - 1}px)`);
  const isNarrow = useMediaQuery(`(max-width: ${BREAKPOINTS.NARROW - 1}px)`);
  const isWide = useMediaQuery(`(min-width: ${BREAKPOINTS.WIDE}px)`);
  return { isMobile, isTablet, isNarrow, isWide };
}
```

- [ ] **Step 2: Переписать `useEditorLayout.ts`**

Полностью заменить содержимое файла:
```typescript
import { useResponsive } from './useResponsive';

type Mode = 'studio' | 'left' | 'right' | 'page';

interface EditorLayout {
  isMobile: boolean;
  isNarrow: boolean;
  isTablet: boolean;
  showLeft: boolean;
  showRight: boolean;
  isPage: boolean;
  cols: string;
  sheetWidth: number | string;
  sheetPad: string;
  wrapPad: string;
}

export function useEditorLayout(mode: Mode): EditorLayout {
  const { isMobile, isNarrow, isTablet, isWide } = useResponsive();
  const showLeft = !isMobile && (mode === 'studio' || mode === 'left');
  const showRight = !isMobile && ((mode === 'studio' && isWide) || mode === 'right');
  const isPage = mode === 'page';

  const cols = isPage
    ? (isMobile ? '1fr' : '56px 1fr')
    : showLeft && showRight
    ? '260px 1fr 320px'
    : showLeft
    ? '260px 1fr'
    : showRight
    ? '1fr 320px'
    : '1fr';

  const sheetWidth = isMobile ? '100%' : isTablet ? (isPage ? 600 : 560) : (isPage ? 740 : 680);
  const sheetPad = isMobile
    ? '24px 20px 80px'
    : isTablet
    ? (isPage ? '48px 40px 80px' : '36px 32px 80px')
    : (isPage ? '64px 80px 80px' : '48px 64px 80px');
  const wrapPad = isMobile
    ? '16px 8px 0'
    : isTablet
    ? (isPage ? '32px 24px 0' : '24px 20px 0')
    : (isPage ? '48px 56px 0' : '36px 32px 0');

  return { isMobile, isNarrow, isTablet, showLeft, showRight, isPage, cols, sheetWidth, sheetPad, wrapPad };
}
```

- [ ] **Step 3: Удалить `useWindowWidth.ts`**

```bash
rm "src/lib/useWindowWidth.ts"
```

- [ ] **Step 4: Проверка**

```bash
npm run typecheck
npm run lint
```

Ожидаемый результат: 0 ошибок. Особо убедиться, что `useWindowWidth` нигде не импортируется.

- [ ] **Step 5: Commit**

```bash
git add src/lib/useResponsive.ts src/lib/useEditorLayout.ts
git rm src/lib/useWindowWidth.ts
git commit -m "refactor(responsive): убрать useWindowWidth, isWide в useResponsive"
```

---

## Task 3: `useCharacterMutations` — убрать `queryClient` из параметров

**Files:**
- Modify: `src/lib/useCharacterMutations.ts` (использовать `useQueryClient()` внутри хука)
- Modify: `src/pages/Characters.tsx` (убрать `queryClient` из вызова хука)

**Контекст.** Хук принимает `queryClient` снаружи, хотя может получить его сам через `useQueryClient()`. Это лишний параметр в интерфейсе из 9 элементов. Убирая его, хук становится самодостаточным в управлении кешем.

- [ ] **Step 1: Обновить `useCharacterMutations.ts`**

Убрать `QueryClient` из imports и из `UseCharacterMutationsOptions`, добавить `useQueryClient` из `@tanstack/react-query`:

```typescript
import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  createCharacter,
  deleteCharacter,
  type Character,
} from './characters';
import {
  createRelationship,
  deleteRelationship,
  updateRelationshipLabels,
  type CharacterRelationship,
} from './relationships';
import { QUERY_KEYS } from './queries';

interface UseCharacterMutationsOptions {
  bookId: string | undefined;
  userId: string | undefined;
  characters: Character[] | undefined;
  active: Character | null;
  cancelSave: () => void;
  onError: (msg: string) => void;
  onCreated: (id: string) => void;
  onDeleted: (remaining: Character[], deletedId: string) => void;
}

export function useCharacterMutations({
  bookId,
  userId,
  characters,
  active,
  cancelSave,
  onError,
  onCreated,
  onDeleted,
}: UseCharacterMutationsOptions) {
  const queryClient = useQueryClient();
  const creatingRef = useRef(false);

  const onCreate = useCallback(async () => {
    if (!bookId || !userId || creatingRef.current) return;
    creatingRef.current = true;
    const position = characters?.length ?? 0;
    try {
      const created = await createCharacter(bookId, userId, {
        name: '',
        role: 'protagonist',
        position,
      });
      queryClient.setQueryData<Character[]>(QUERY_KEYS.characters(bookId), (prev) => [...(prev ?? []), created]);
      onCreated(created.id);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      creatingRef.current = false;
    }
  }, [bookId, userId, characters, queryClient, onCreated, onError]);

  const onDeleteConfirmed = useCallback(async (characterId: string) => {
    if (!characters || !bookId) return;
    cancelSave();
    try {
      await deleteCharacter(characterId);
      const remaining = characters.filter((c) => c.id !== characterId);
      queryClient.setQueryData<Character[]>(QUERY_KEYS.characters(bookId), remaining);
      queryClient.setQueryData<CharacterRelationship[]>(QUERY_KEYS.relationships(bookId), (prev) =>
        prev ? prev.filter((r) => r.char_a_id !== characterId && r.char_b_id !== characterId) : prev
      );
      onDeleted(remaining, characterId);
    } catch (e) {
      onError((e as Error).message);
    }
  }, [characters, bookId, queryClient, cancelSave, onDeleted, onError]);

  const onCreateRelationship = useCallback(async (toId: string, labelMine: string, labelTheirs: string) => {
    if (!bookId || !userId || !active) return;
    try {
      const created = await createRelationship(bookId, userId, active.id, toId, labelMine, labelTheirs);
      queryClient.setQueryData<CharacterRelationship[]>(QUERY_KEYS.relationships(bookId), (prev) => [...(prev ?? []), created]);
    } catch (e) {
      onError((e as Error).message);
    }
  }, [bookId, userId, active, queryClient, onError]);

  const onDeleteRelationship = useCallback(async (id: string) => {
    if (!bookId) return;
    try {
      await deleteRelationship(id);
      queryClient.setQueryData<CharacterRelationship[]>(QUERY_KEYS.relationships(bookId), (prev) =>
        prev ? prev.filter((r) => r.id !== id) : prev
      );
    } catch (e) {
      onError((e as Error).message);
    }
  }, [bookId, queryClient, onError]);

  const onRelationshipLabelChange = useCallback(async (id: string, labelMine: string, labelTheirs: string) => {
    if (!bookId || !active) return;
    const rels = queryClient.getQueryData<CharacterRelationship[]>(QUERY_KEYS.relationships(bookId));
    const rel = rels?.find((r) => r.id === id);
    if (!rel) return;
    const iAmA = rel.char_a_id === active.id;
    const patch = iAmA
      ? { label_a: labelMine, label_b: labelTheirs }
      : { label_b: labelMine, label_a: labelTheirs };
    try {
      const updated = await updateRelationshipLabels(id, patch);
      queryClient.setQueryData<CharacterRelationship[]>(QUERY_KEYS.relationships(bookId), (prev) =>
        prev ? prev.map((r) => (r.id === id ? updated : r)) : prev
      );
    } catch (e) {
      onError((e as Error).message);
    }
  }, [bookId, active, queryClient, onError]);

  return { onCreate, onDeleteConfirmed, onCreateRelationship, onDeleteRelationship, onRelationshipLabelChange };
}
```

- [ ] **Step 2: Обновить `Characters.tsx` — убрать `queryClient` из вызова**

Найти вызов `useCharacterMutations` (строки 161–171) и убрать строку `queryClient,`:
```typescript
const { onCreate, onDeleteConfirmed, onCreateRelationship, onDeleteRelationship, onRelationshipLabelChange } = useCharacterMutations({
  bookId,
  userId: user?.id,
  characters,
  active,
  cancelSave,
  onError: setError,
  onCreated: handleCreated,
  onDeleted: handleDeleted,
});
```

Убедиться, что `queryClient` в `Characters.tsx` всё ещё нужен для других операций (строки 101–107 и 121–127 — `debouncedSave` и `scheduleSave`). Если нужен — оставить объявление `const queryClient = useQueryClient()`, иначе убрать.

- [ ] **Step 3: Проверка**

```bash
npm run typecheck
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/useCharacterMutations.ts src/pages/Characters.tsx
git commit -m "refactor(characters): useQueryClient внутри useCharacterMutations"
```

---

## Task 4: `useVersionMutations` — скрыть кеш от `VersionsPanel`

**Files:**
- Create: `src/lib/useVersionMutations.ts`
- Modify: `src/components/VersionsPanel.tsx`

**Контекст.** `VersionsPanel` напрямую вызывает `createVersion`, `deleteVersion`, `useQueryClient`, и знает о `QUERY_KEYS.chapterVersions`. Это детали реализации, которые не должны вытекать в компонент. Новый хук `useVersionMutations` прячет их внутри.

- [ ] **Step 1: Создать `src/lib/useVersionMutations.ts`**

```typescript
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createVersion, deleteVersion } from './versions';
import { countWords } from './chapters';
import { QUERY_KEYS } from './queries';

export function useVersionMutations(chapterId: string, userId: string, isPro: boolean) {
  const queryClient = useQueryClient();

  const createNamed = useCallback(async (content: string, label: string): Promise<void> => {
    await createVersion(chapterId, userId, content, countWords(content), 'manual', isPro, label);
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapterVersions(chapterId) });
  }, [chapterId, userId, isPro, queryClient]);

  const remove = useCallback(async (id: string): Promise<void> => {
    await deleteVersion(id);
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapterVersions(chapterId) });
  }, [chapterId, queryClient]);

  return { createNamed, remove };
}
```

- [ ] **Step 2: Обновить `VersionsPanel.tsx`**

Изменить imports в начале файла — убрать прямые импорты data-функций и query-клиента:

```typescript
import { useState } from 'react';
import { useVersionMutations } from '../lib/useVersionMutations';
import { type ChapterVersionMeta } from '../lib/versions';
import { useChapterVersions } from '../lib/queries';
import { VersionModal } from './VersionModal';
import { useErrorState } from '../lib/useErrorState';
```

(Убраны: `useQueryClient`, `createVersion`, `deleteVersion`, `countWords`, `QUERY_KEYS`)

Изменить тело компонента — заменить `useQueryClient()` и прямые вызовы на хук:

```typescript
export function VersionsPanel({ chapterId, chapterTitle, bookId, userId, currentContent, isPro, onRestoreContent }: VersionsPanelProps) {
  const { error: versionError, setError: setVersionError, clearError: clearVersionError } = useErrorState();
  const { data: versions = [], isLoading } = useChapterVersions(chapterId);
  const { createNamed, remove } = useVersionMutations(chapterId, userId, isPro);
  const [selected, setSelected] = useState<ChapterVersionMeta | null>(null);
  const [saving, setSaving] = useState(false);
  const [labelInput, setLabelInput] = useState('');
  const [showLabelForm, setShowLabelForm] = useState(false);

  const named = versions.filter((v) => v.label !== null);
  const auto = versions.filter((v) => v.label === null);
  const grouped = groupByDay(auto);

  async function handleSaveLabel() {
    if (!labelInput.trim()) return;
    setSaving(true);
    try {
      await createNamed(currentContent, labelInput.trim());
      setLabelInput('');
      setShowLabelForm(false);
    } catch (e) {
      setVersionError(e instanceof Error ? e.message : 'Не удалось сохранить версию');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await remove(id);
    } catch (e) {
      setVersionError(e instanceof Error ? e.message : 'Не удалось удалить версию');
    }
  }
  // ... остальная часть компонента без изменений
```

- [ ] **Step 3: Проверка типов**

```bash
npm run typecheck
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/useVersionMutations.ts src/components/VersionsPanel.tsx
git commit -m "refactor(versions): useVersionMutations скрывает кеш от VersionsPanel"
```

---

## Task 5: ADR — shallow proxy modules (locations, connections, timeline)

**Files:**
- Create: `docs/adr/0001-shallow-proxy-modules.md`

**Контекст.** `locations.ts`, `connections.ts`, `timeline.ts` — тонкие обёртки над `createRepository`. По deletion test — pass-through без leverage. Решение: не рефакторить существующие (они не создают активного трения), но зафиксировать решение в ADR, чтобы будущий ревью не предлагал их углублять.

- [ ] **Step 1: Создать ADR**

```markdown
# ADR-0001: Не углублять proxy-модули (locations, connections, timeline)

**Дата:** 2026-06-08  
**Статус:** Принято

## Контекст

`src/lib/locations.ts`, `src/lib/connections.ts`, `src/lib/timeline.ts` — тонкие обёртки над `createRepository<T>()`. Каждый файл содержит: (1) типы и константы меток (`TYPE_LABELS`, `TYPE_GLYPHS`, `ROLE_COLOR`), (2) CRUD-функции, которые делегируют репозиторию.

По deletion test — удаление этих файлов не концентрирует сложность: вызывающий код напрямую использовал бы `createRepository` с теми же параметрами.

## Решение

Не выносить CRUD-функции этих файлов в более глубокий слой и не создавать дополнительных абстракций.

## Обоснование

1. **Константы обязаны жить рядом с типом** (конвенция CLAUDE.md). Файл-тип == файл-константа — это уже правильно.
2. **CRUD не содержит доменной логики**, которую стоит прятать. Если она появится (валидация, каскады, события) — углублять при необходимости, а не заранее.
3. **Конвенция `createRepository`** уже даёт единое поведение для ошибок, дефолтов и сортировки. Добавочный слой без новой логики — лишний индиректион.

## Следствия

- Не создавать store/service-классы для locations/connections/timeline без появления реальной доменной логики.
- При добавлении новой сущности с `book_id` — следовать тому же паттерну (тип + константы + createRepository), а не создавать «глубокий» модуль авансом.
```

- [ ] **Step 2: Commit**

```bash
git add docs/adr/0001-shallow-proxy-modules.md
git commit -m "docs(adr): зафиксировать решение по shallow proxy modules"
```

---

## Self-Review

**Spec coverage:**
- Fix 4 (plural) → Task 1 ✓
- Fix 3 (responsive) → Task 2 ✓
- Fix 5 (useCharacterMutations queryClient) → Task 3 ✓
- Fix 1 (версионирование → useVersionMutations) → Task 4 ✓
- Fix 6 (shallow modules ADR) → Task 5 ✓
- Fix 2 (cache mutations) → покрывается Task 3 (characters) + Task 4 (versions). Chapter cache уже координирован через `chapterMutations.ts`. Дополнительных изменений не требует.

**Placeholder scan:** Нет TBD/TODO/плейсхолдеров.

**Type consistency:**
- `useVersionMutations` — `createNamed(content, label)` → в `VersionsPanel` вызов `createNamed(currentContent, labelInput.trim())` ✓
- `remove(id)` → `remove(id)` в `handleDelete` ✓
- `useCharacterMutations` — убран `queryClient` из типа → убран из вызова в Characters.tsx ✓
- `useEditorLayout` — возвращает тот же `EditorLayout` тип, EditorHybrid.tsx деструктурирует `{ isMobile, showLeft, showRight, isPage, cols, sheetWidth, sheetPad, wrapPad }` ✓
