# /audit — Codebase Health Scanner

Scan the project for 7 categories of issues. **Never edit files. Report findings only.**

## Excluded paths

Never scan: `_design-source/`, `node_modules/`, `dist/`, `graphify-out/`, `.claude/`, `.agents/`

---

## Phase 1 — Discovery

Run all grep searches in parallel. Collect every match as a flat list with `file:line`. Do not evaluate yet — just gather.

### Category 1: Duplicate components

```bash
grep -rn 'type="password"' src/ --include="*.tsx" --include="*.ts"
```
Flag any `type="password"` found outside `src/components/PasswordInput.tsx`.

```bash
grep -rn 'onChange.*password\|value.*password' src/pages/ --include="*.tsx"
```
Flag duplicated form-field password patterns in pages.

### Category 2: Race conditions

```bash
grep -rn 'useEffect' src/ --include="*.tsx" --include="*.ts" -A 8
```
Flag useEffect blocks that set state after an `await` with no `let mounted = true` guard.

```bash
grep -rn 'new IntersectionObserver' src/ --include="*.tsx" --include="*.ts" -A 12
```
Flag IntersectionObserver created without a `disconnect()` call in the cleanup return.

### Category 3: Auth guard placement

```bash
grep -rn 'useQuery\|supabase\.' src/pages/ --include="*.tsx" -l
```
Cross-reference with routes in `src/App.tsx` — flag any page that fetches data but is NOT wrapped in `<AuthGuard>`.

### Category 4: TypeScript strictness

```bash
grep -rn ' as [A-Z][a-zA-Z]' src/ --include="*.tsx" --include="*.ts"
```
Flag `as SomeType` casts **outside** `src/lib/repository.ts`.

```bash
grep -rn ': any\b\|: any>' src/ --include="*.tsx" --include="*.ts"
```
Flag any `any` type annotation.

```bash
grep -rn 'isLoading.*isError\|isError.*isEmpty\|isPending.*isError\|isLoading.*isPending.*isError' src/ --include="*.tsx" --include="*.ts"
```
Flag objects with 3+ boolean state flags where a discriminated union (`'loading' | 'error' | 'empty' | 'ready'`) would fit.

### Category 5: React Query patterns

```bash
grep -rn 'useState.*data\b' src/ --include="*.tsx" --include="*.ts" -B 2 -A 2
```
Flag `useState` initialised directly from `useQuery` result (pattern: `useState(queryResult.data)` or `useState(data)`).

```bash
grep -rn 'setQueryData' src/ --include="*.tsx" --include="*.ts" -A 8
```
Flag any `setQueryData` followed by `invalidateQueries` on the same query key within the same mutation block.

```bash
grep -rn 'onError.*console\.error\|onError.*alert(' src/ --include="*.tsx" --include="*.ts"
```
Flag `onError` callbacks using `console.error` or `alert` instead of `setError`.

### Category 6: CSS / design system

```bash
grep -rn 'style={{' src/ --include="*.tsx" -A 3
```
Flag `style={{ }}` props containing visual properties — `color`, `background`, `border`, `fontSize`, `padding`, `margin`, `fontFamily`, `fontWeight` — on elements that have a CSS class equivalent in `design-system.css`.

```bash
grep -rn 'className=.*\.tb-\|className=.*\.btn\|className=.*\.input\|className=.*\.modal\|className=.*\.char' src/pages/ --include="*.tsx"
```
Flag className applied from outside that overrides visual internals of a component (not layout properties).

### Category 7: Supabase patterns

```bash
grep -rn '\.from(' src/ --include="*.tsx" --include="*.ts"
```
Flag any `.from(table)` calls **outside** `src/lib/repository.ts` for tables that have `book_id`: `books`, `chapters`, `characters`, `notes`, `timeline_events`, `locations`, `character_connections`, `character_relationships`, `character_relations`.

```bash
grep -rn 'Promise\.all.*\.map' src/ --include="*.tsx" --include="*.ts" -A 4
```
Flag `Promise.all(array.map(id => supabase.update...))` mutation loops. Should be `upsert([...rows])` or `.delete().in('id', ids)`.

---

## Phase 2 — Analysis

For each raw match from Phase 1, evaluate:

**Is it a real violation?**

| Match | Verdict |
|-------|---------|
| `as` cast inside `src/lib/repository.ts` | ✅ Allowed — skip |
| `useEffect` with only synchronous state, no `await` | ✅ Not a race condition — skip |
| `new IntersectionObserver` with `.disconnect()` in cleanup | ✅ Correct — skip |
| `.from(table)` for tables without `book_id` (e.g. `app_settings`, `profiles`) | ✅ Allowed — skip |
| Page without data fetching, inside AuthGuard check | ✅ Not a violation — skip |
| `useState` with a computed default, not from `useQuery` | ✅ Not a violation — skip |

**Severity:**

- 🔴 **Блокирует** — can cause runtime bug, data loss, or security issue: race conditions that cause state updates on unmounted components; missing auth guard on a page that fetches user data; Supabase mutation loop that fires N requests
- 🟡 **Важно** — violates project conventions, causes maintainability pain: `any`/`as` violations outside repository.ts; React Query `setQueryData+invalidateQueries` double-update; `onError` without `setError`; CSS cosmetic overrides from outside
- 🟢 **Nice-to-have** — minor cosmetic or low-risk: single small inline style with no class equivalent; duplicated pattern in 2 files but not causing bugs; boolean flags that could become a union but aren't causing errors

Discard false positives silently. Do not mention them in the report.

---

## Phase 3 — Report

Output grouped by severity. Format for each finding:

```
🔴 Race condition — src/pages/Editor.tsx:142
   useEffect sets `content` state after async fetch with no cleanup or mounted-guard.
   Proposed fix: add `let mounted = true` before fetch; `if (mounted) setContent(data)`; return `() => { mounted = false }`.
```

Rules:
- 🔴 first, then 🟡, then 🟢
- Each finding: emoji + category label + `file:line`, one-sentence description, one concrete proposed fix with actual code or pattern
- If no findings in a severity group, omit that group entirely
- End report with summary line: `**N findings: X 🔴  Y 🟡  Z 🟢**`
- After the report ask: **"Применить какой-нибудь из этих фиксов?"**
- Do NOT edit any files until the user explicitly confirms which finding to fix
