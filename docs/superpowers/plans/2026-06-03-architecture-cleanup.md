# Architecture Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 architectural issues identified in the codebase audit: N+1 DB calls, DRY violations in relationships.ts, scattered role constants, untyped DB errors, and no safety limits on large fetches.

**Architecture:** Each task is independent — apply in any order. Tasks 1–5 touch different files with no cross-dependencies (except Task 4 DbError used in Task 5, and Dashboard.tsx needing update after Task 4).

**Tech Stack:** TypeScript strict, Supabase JS v2, React Query v5, Vite

---

## Task 1: Batch crossrefs DB operations (N+1 → 2)

**Files:**
- Modify: `src/lib/crossrefs.ts` — `syncCharacterAcrossAllChapters` (lines 51–88) and `syncBacklinks` (lines 128–163)

Both functions currently do one upsert + one delete **per chapter** inside `Promise.all`. With 100 chapters = 200 DB calls. Fix: collect results first, then 1 batch upsert + 1 batch delete.

- [ ] **Step 1: Replace `syncCharacterAcrossAllChapters`**

Replace lines 51–88 in `src/lib/crossrefs.ts` with:

```typescript
export async function syncCharacterAcrossAllChapters(
  character: Character,
  bookId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('chapters')
    .select('id, content')
    .eq('book_id', bookId);
  if (error || !data) return;

  const aliases = [character.name, ...(character.aliases ?? [])].filter(Boolean);
  const found: string[] = [];
  const notFound: string[] = [];

  for (const chapter of data) {
    if (extractCharacterMentions(chapter.content ?? '', aliases)) {
      found.push(chapter.id);
    } else {
      notFound.push(chapter.id);
    }
  }

  if (found.length > 0) {
    await supabase.from('chapter_characters').upsert(
      found.map((chapterId) => ({
        book_id: bookId,
        user_id: character.user_id,
        chapter_id: chapterId,
        character_id: character.id,
        auto_detected: true,
      })),
      { onConflict: 'chapter_id,character_id', ignoreDuplicates: true },
    );
  }

  if (notFound.length > 0) {
    await supabase
      .from('chapter_characters')
      .delete()
      .in('chapter_id', notFound)
      .eq('character_id', character.id)
      .eq('auto_detected', true)
      .eq('is_pov', false);
  }
}
```

- [ ] **Step 2: Replace `syncBacklinks`**

Replace lines 128–163 in `src/lib/crossrefs.ts` with:

```typescript
export async function syncBacklinks(
  chapterId: string,
  bookId: string,
  content: string,
  characters: Character[],
): Promise<void> {
  const found: { bookId: string; userId: string; chapterId: string; characterId: string }[] = [];
  const notFoundIds: string[] = [];

  for (const character of characters) {
    const aliases = [character.name, ...(character.aliases ?? [])].filter(Boolean);
    if (extractCharacterMentions(content, aliases)) {
      found.push({
        bookId,
        userId: character.user_id,
        chapterId,
        characterId: character.id,
      });
    } else {
      notFoundIds.push(character.id);
    }
  }

  if (found.length > 0) {
    await supabase.from('chapter_characters').upsert(
      found.map((f) => ({
        book_id: f.bookId,
        user_id: f.userId,
        chapter_id: f.chapterId,
        character_id: f.characterId,
        auto_detected: true,
      })),
      { onConflict: 'chapter_id,character_id', ignoreDuplicates: true },
    );
  }

  if (notFoundIds.length > 0) {
    await supabase
      .from('chapter_characters')
      .delete()
      .eq('chapter_id', chapterId)
      .in('character_id', notFoundIds)
      .eq('auto_detected', true)
      .eq('is_pov', false);
  }
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/crossrefs.ts
git commit -m "perf(crossrefs): batch upsert/delete — N+1 → 2 DB calls per sync"
```

---

## Task 2: Fix relationships.ts — use createRepository instead of manual Supabase

**Files:**
- Modify: `src/lib/relationships.ts` — replace manual `.from().select().eq().order()` with `createRepository`

`listRelations` and `listRelationships` duplicate what `createRepository.list()` already does. `createRelation`, `updateRelationLabel`, `deleteRelation` can all delegate to repo methods too.

- [ ] **Step 1: Rewrite relationships.ts**

Replace the entire content of `src/lib/relationships.ts`:

```typescript
import { createRepository } from './repository';
import { supabase } from './supabase';

// --- Directed relations (character_relations: from → to) ---

export interface CharacterRelation {
  id: string;
  book_id: string;
  user_id: string;
  from_character_id: string;
  to_character_id: string;
  label: string;
  created_at: string;
  updated_at: string;
}

const relationsRepo = createRepository<CharacterRelation>(
  'character_relations',
  {},
  [{ column: 'created_at', ascending: true }],
);

export function listRelations(bookId: string): Promise<CharacterRelation[]> {
  return relationsRepo.list(bookId);
}

export function createRelation(
  bookId: string,
  userId: string,
  fromId: string,
  toId: string,
  label: string,
): Promise<CharacterRelation> {
  return relationsRepo.create(bookId, userId, {
    from_character_id: fromId,
    to_character_id: toId,
    label,
  });
}

export function updateRelationLabel(id: string, label: string): Promise<CharacterRelation> {
  return relationsRepo.update(id, { label });
}

export function deleteRelation(id: string): Promise<void> {
  return relationsRepo.delete(id);
}

// --- Bilateral relationships (character_relationships: charIdA < charIdB canonical) ---

export interface CharacterRelationship {
  id: string;
  book_id: string;
  user_id: string;
  char_a_id: string;
  char_b_id: string;
  label_a: string;
  label_b: string;
  created_at: string;
  updated_at: string;
}

const relationshipsRepo = createRepository<CharacterRelationship>(
  'character_relationships',
  {},
  [{ column: 'created_at', ascending: true }],
);

export function listRelationships(bookId: string): Promise<CharacterRelationship[]> {
  return relationshipsRepo.list(bookId);
}

export async function createRelationship(
  bookId: string,
  userId: string,
  charIdA: string,
  charIdB: string,
  labelMine: string,
  labelTheirs: string,
): Promise<CharacterRelationship> {
  const canonical = charIdA < charIdB;
  return relationshipsRepo.create(bookId, userId, {
    char_a_id: canonical ? charIdA : charIdB,
    char_b_id: canonical ? charIdB : charIdA,
    label_a: canonical ? labelMine : labelTheirs,
    label_b: canonical ? labelTheirs : labelMine,
  });
}

export function updateRelationshipLabels(
  id: string,
  patch: { label_a?: string; label_b?: string },
): Promise<CharacterRelationship> {
  return relationshipsRepo.update(id, patch);
}

export function deleteRelationship(id: string): Promise<void> {
  return relationshipsRepo.delete(id);
}
```

Note: the `supabase` import is removed since all operations go through `createRepository`.

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: no errors. If lint complains about unused `supabase` import — it's already removed in Step 1.

- [ ] **Step 3: Commit**

```bash
git add src/lib/relationships.ts
git commit -m "refactor(relationships): use createRepository — remove manual Supabase queries"
```

---

## Task 3: Move ROLE_COLOR / ROLE_PORTRAIT_BG to characters.ts

**Files:**
- Modify: `src/lib/characters.ts` — add two exported constants
- Modify: `src/pages/Characters.tsx` — remove local constants, add to import

`ROLE_COLOR` and `ROLE_PORTRAIT_BG` are defined as local constants in `Characters.tsx` (lines 39–49) but logically belong next to `ROLE_LABELS` in `characters.ts`. Any future component that needs role styling would have to copy-paste them.

- [ ] **Step 1: Add constants to characters.ts**

Append to `src/lib/characters.ts` after the `ROLE_LABELS` block:

```typescript
export const ROLE_COLOR: Record<CharacterRole, string> = {
  protagonist: 'var(--accent)',
  secondary: 'var(--info)',
  minor: 'var(--ink-4)',
};

export const ROLE_PORTRAIT_BG: Record<CharacterRole, string> = {
  protagonist: 'linear-gradient(160deg, oklch(0.38 0.12 30), oklch(0.22 0.07 30))',
  secondary: 'linear-gradient(160deg, oklch(0.34 0.035 60), oklch(0.22 0.02 55))',
  minor: 'linear-gradient(160deg, oklch(0.30 0.03 80), oklch(0.20 0.02 80))',
};
```

- [ ] **Step 2: Remove local constants from Characters.tsx and update import**

In `src/pages/Characters.tsx`, delete lines 39–49 (the `ROLE_COLOR` and `ROLE_PORTRAIT_BG` local declarations).

Update the import from `'../lib/characters'` (lines 10–18) to include the two new exports:

```typescript
import {
  initialsFromName,
  ROLE_LABELS,
  ROLE_COLOR,
  ROLE_PORTRAIT_BG,
  updateCharacter,
  uploadCharacterAvatar,
  type Character,
  type CharacterPatch,
  type CharacterRole,
} from '../lib/characters';
```

- [ ] **Step 3: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: no errors. `noUnusedLocals` will catch if the constants are referenced in Characters.tsx — verify usages exist in the file before removing.

- [ ] **Step 4: Commit**

```bash
git add src/lib/characters.ts src/pages/Characters.tsx
git commit -m "refactor(characters): move ROLE_COLOR/ROLE_PORTRAIT_BG to characters.ts"
```

---

## Task 4: Typed DB errors in repository.ts

**Files:**
- Modify: `src/lib/repository.ts` — export `DbError` class, use it in all throw sites
- Modify: `src/pages/Dashboard.tsx` — replace unsafe `as { code?: string }` cast with `instanceof DbError`

Currently `repository.ts` throws raw `PostgrestError` objects. Dashboard.tsx and other callers use unsafe `as` casts to read `.code`. A typed class makes error handling correct and readable.

- [ ] **Step 1: Add DbError class and helper to repository.ts**

At the top of `src/lib/repository.ts`, after the `import` line, add:

```typescript
export class DbError extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
    readonly table: string,
  ) {
    super(`[${table}] ${message}`);
    this.name = 'DbError';
  }
}

function toDbError(err: { message: string; code?: string }, table: string): DbError {
  return new DbError(err.message, err.code, table);
}
```

- [ ] **Step 2: Replace all `throw error` in repository.ts with `throw toDbError(error, table)`**

In `createRepository`, change every `if (error) throw error;` to `if (error) throw toDbError(error, table);`.

There are 4 occurrences — in `list`, `create`, `update`, `delete`.

Full updated `createRepository` body:

```typescript
export function createRepository<T>(
  table: string,
  defaults: Record<string, unknown> = {},
  orderBy: OrderClause[] = [{ column: 'created_at', ascending: true }],
): Repository<T> {
  return {
    async list(bookId) {
      const base = supabase.from(table).select('*').eq('book_id', bookId);
      const q = orderBy.reduce((acc, o) => acc.order(o.column, { ascending: o.ascending }), base);
      const { data, error } = await q;
      if (error) throw toDbError(error, table);
      return (data ?? []) as T[];
    },

    async create(bookId, userId, patch = {}) {
      const { data, error } = await supabase
        .from(table)
        .insert({ book_id: bookId, user_id: userId, ...defaults, ...patch })
        .select('*')
        .single();
      if (error) throw toDbError(error, table);
      return data as T;
    },

    async update(id, patch) {
      const { data, error } = await supabase
        .from(table)
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw toDbError(error, table);
      return data as T;
    },

    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw toDbError(error, table);
    },
  };
}
```

- [ ] **Step 3: Fix Dashboard.tsx isBookNotFound check**

Open `src/pages/Dashboard.tsx`. Find the line that reads:

```typescript
const isBookNotFound = (bookError as { code?: string } | null)?.code === 'PGRST116';
```

Replace with:

```typescript
import { DbError } from '../lib/repository';
// ...
const isBookNotFound = bookError instanceof DbError && bookError.code === 'PGRST116';
```

Add the `DbError` import to the existing import block at the top of Dashboard.tsx.

- [ ] **Step 4: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/repository.ts src/pages/Dashboard.tsx
git commit -m "refactor(repository): typed DbError class — removes unsafe 'as' casts on error codes"
```

---

## Task 5: Safety limit on repository.list()

**Files:**
- Modify: `src/lib/repository.ts` — add optional `limit` param to `list()`

No current query has a safety cap. If a book somehow accumulates 2000+ characters (import, bug), a single `useCharacters()` call downloads all of them. Adding an optional `limit` is a non-breaking safety net.

- [ ] **Step 1: Extend the Repository interface**

In `src/lib/repository.ts`, update the `Repository` interface:

```typescript
export interface Repository<T> {
  list(bookId: string, options?: { limit?: number }): Promise<T[]>;
  create(bookId: string, userId: string, patch?: Record<string, unknown>): Promise<T>;
  update(id: string, patch: Record<string, unknown>): Promise<T>;
  delete(id: string): Promise<void>;
}
```

- [ ] **Step 2: Apply the limit in the list implementation**

In the `list` method inside `createRepository`, after the `orderBy.reduce(...)` line, apply the limit:

```typescript
async list(bookId, options = {}) {
  const base = supabase.from(table).select('*').eq('book_id', bookId);
  let q = orderBy.reduce((acc, o) => acc.order(o.column, { ascending: o.ascending }), base);
  if (options.limit) q = q.limit(options.limit);
  const { data, error } = await q;
  if (error) throw toDbError(error, table);
  return (data ?? []) as T[];
},
```

- [ ] **Step 3: Add a 500-row cap to useCharacters in queries.ts**

In `src/lib/queries.ts`, update `useCharacters` to pass a limit as a safety cap for unusually large datasets:

```typescript
export function useCharacters(bookId: string | undefined) {
  return useQuery<Character[]>(makeQuery(
    bookId ? QUERY_KEYS.characters(bookId) : ['characters', null],
    () => listCharacters(bookId!, { limit: 500 }),
    2 * 60_000,
  ));
}
```

- [ ] **Step 4: Propagate the options param to listCharacters**

In `src/lib/characters.ts`, update the `listCharacters` signature:

```typescript
export function listCharacters(bookId: string, options?: { limit?: number }): Promise<Character[]> {
  return repo.list(bookId, options);
}
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no errors. Callers that don't pass `options` continue working — it's optional.

- [ ] **Step 6: Commit**

```bash
git add src/lib/repository.ts src/lib/characters.ts src/lib/queries.ts
git commit -m "feat(repository): optional limit param on list() — safety cap for large datasets"
```

---

## Final check

- [ ] **Run typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: clean.

- [ ] **Start dev server and verify Characters page loads**

```bash
npm run dev
```

Navigate to a book's Characters page. Verify: characters load, adding/editing/deleting a character works, relationship panel opens.
