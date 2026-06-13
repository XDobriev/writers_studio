# Map Stamps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add terrain stamp placement (mountains, forest, lakes, etc.) to the world map, closing the gap between the landing page mockup and the real editor.

**Architecture:** New `map_stamps` Supabase table stores stamps as (type, x, y, size). `MapStampsLayer.tsx` renders them inside the existing WorldMap SVG between the background and connections layers. `StampPopup.tsx` provides editing. Map.tsx wires data and handlers.

**Tech Stack:** Supabase (Postgres + RLS), React Query, React 18, SVG inline rendering, existing `createRepository` pattern.

---

## Pre-flight: what is already done

`river` is **already** implemented as a `ConnectionStyle` in `src/lib/connections.ts` and `src/lib/mapExport.ts`. Skip any spec references to "add river style".

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/0035_map_stamps.sql` | **Create** | DB table + RLS + index + GRANT |
| `src/lib/mapStamps.ts` | **Create** | Types, SVG definitions, CRUD via `createRepository` |
| `src/lib/queries.ts` | **Modify** | Add `QUERY_KEYS.stamps` + `useStamps` hook |
| `src/components/MapStampsLayer.tsx` | **Create** | Pure SVG `<g>` rendering stamps + selection ring |
| `src/components/StampPopup.tsx` | **Create** | Popup: type picker grid, size slider, delete |
| `src/pages/Map.tsx` | **Modify** | Add `'stamp'` to MapMode, state, handlers, sidebar picker |
| `src/components/WorldMap.tsx` | **Modify** | New props, pointer handler extensions, render layer + popup |
| `src/lib/mapExport.ts` | **Modify** | `buildStampsSvg`, add `stamps` param to export functions |
| `docs/features/maps.md` | **Modify** | Add stamps section |
| `CLAUDE.md` | **Modify** | Register new components + lib in Architecture section |

---

## Task 1: Supabase Migration

**Files:**
- Create: `supabase/migrations/0035_map_stamps.sql`

- [ ] **Step 1: Write the migration file**

```sql
CREATE TABLE public.map_stamps (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id    uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id),
  type       text NOT NULL,
  x          float8 NOT NULL,
  y          float8 NOT NULL,
  size       float8 NOT NULL DEFAULT 1.0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.map_stamps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner" ON public.map_stamps
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX ON public.map_stamps (book_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.map_stamps TO anon, authenticated;
```

- [ ] **Step 2: Apply via Supabase MCP**

Use `mcp__supabase__apply_migration` with `name: "map_stamps"` and the SQL above.

- [ ] **Step 3: Verify table exists**

Use `mcp__supabase__execute_sql` with `SELECT table_name FROM information_schema.tables WHERE table_name = 'map_stamps';`

Expected: one row returned.

---

## Task 2: `src/lib/mapStamps.ts`

**Files:**
- Create: `src/lib/mapStamps.ts`

- [ ] **Step 1: Create the file**

```typescript
import { createRepository } from './repository';

export type StampType =
  | 'mountain' | 'hills' | 'forest' | 'tree' | 'lake'
  | 'desert' | 'snow' | 'swamp' | 'ruins' | 'cave';

export interface MapStamp {
  id: string;
  book_id: string;
  user_id: string;
  type: StampType;
  x: number;
  y: number;
  size: number;
  created_at: string;
}

export type StampPatch = Partial<Pick<MapStamp, 'type' | 'x' | 'y' | 'size'>>;

export const STAMP_TYPES: readonly StampType[] = [
  'mountain', 'hills', 'forest', 'tree', 'lake',
  'desert', 'snow', 'swamp', 'ruins', 'cave',
];

export const STAMP_LABELS: Record<StampType, string> = {
  mountain: 'Горы',
  hills:    'Холмы',
  forest:   'Лес',
  tree:     'Дерево',
  lake:     'Озеро',
  desert:   'Пустыня',
  snow:     'Снег',
  swamp:    'Болото',
  ruins:    'Руины',
  cave:     'Пещера',
};

// Raw SVG fragments for a 40×32 coordinate space.
// Rendered with an outer translate(-20,-16) to center at origin.
// Used for both React rendering (MapStampsLayer) and PNG export (mapExport).
export const STAMP_SVG: Record<StampType, string> = {
  mountain: `<polygon points="20,4 6,28 34,28" fill="#8a7060" stroke="#5a3f28" stroke-width="1.5"/><polygon points="28,10 19,28 37,28" fill="#a08070" stroke="#5a3f28" stroke-width="1"/><polygon points="20,4 16,12 24,12" fill="white" opacity="0.5"/>`,
  hills:    `<polygon points="20,8 8,28 32,28" fill="#5a7840" stroke="#3a5020" stroke-width="1"/><polygon points="28,14 20,28 36,28" fill="#6a8850" stroke="#3a5020" stroke-width="1"/>`,
  forest:   `<polygon points="19,3 4,22 34,22" fill="#2d5a27" stroke="#1a3a15" stroke-width="1.2"/><polygon points="19,10 7,25 31,25" fill="#3a6e30" stroke="#1a3a15" stroke-width="1.2"/><rect x="16" y="22" width="6" height="8" fill="#5a3f28"/>`,
  tree:     `<circle cx="20" cy="10" r="8" fill="#2d5a27" stroke="#1a3a15" stroke-width="1"/><rect x="18" y="17" width="4" height="10" fill="#5a3f28"/>`,
  lake:     `<ellipse cx="20" cy="18" rx="16" ry="10" fill="#1a4a70" stroke="#2a6a9a" stroke-width="1.5"/><path d="M8 17 Q14 13 20 17 Q26 21 32 17" stroke="#4a9abf" stroke-width="1.2" fill="none" opacity="0.6"/>`,
  desert:   `<path d="M4 26 Q10 16 16 22 Q22 10 28 18 Q34 8 36 22 L36 28 L4 28Z" fill="#c8a850" stroke="#a08030" stroke-width="1"/><circle cx="28" cy="14" r="5" fill="#e8c860" opacity="0.7"/><line x1="28" y1="6" x2="28" y2="4" stroke="#e8c860" stroke-width="1.5"/><line x1="34" y1="10" x2="36" y2="9" stroke="#e8c860" stroke-width="1.5"/><line x1="22" y1="10" x2="20" y2="9" stroke="#e8c860" stroke-width="1.5"/>`,
  snow:     `<polygon points="20,4 7,28 33,28" fill="#c8d8e8" stroke="#90a8c0" stroke-width="1.5"/><polygon points="20,4 16,14 24,14" fill="white" opacity="0.9"/><polygon points="26,12 18,28 34,28" fill="#d8e8f0" stroke="#90a8c0" stroke-width="1"/>`,
  swamp:    `<path d="M4 28 Q10 18 16 22 Q22 14 28 20 Q32 16 36 22 L36 28 L4 28Z" fill="#3a5a30" opacity="0.7"/><circle cx="12" cy="22" r="3" fill="#2a4a20" opacity="0.6"/><circle cx="22" cy="20" r="2.5" fill="#2a4a20" opacity="0.6"/><circle cx="30" cy="22" r="2" fill="#2a4a20" opacity="0.6"/>`,
  ruins:    `<rect x="6" y="12" width="7" height="16" fill="#6a5a48" stroke="#4a3a2a" stroke-width="1"/><rect x="25" y="16" width="7" height="12" fill="#6a5a48" stroke="#4a3a2a" stroke-width="1"/><line x1="13" y1="28" x2="25" y2="28" stroke="#4a3a2a" stroke-width="1.5"/>`,
  cave:     `<path d="M8 28 Q10 20 20 18 Q30 16 32 28Z" fill="#3a3030" stroke="#2a2020" stroke-width="1"/><circle cx="20" cy="18" r="3" fill="#1a1010"/><path d="M14 22 Q17 19 20 22" stroke="#5a5050" stroke-width="1" fill="none"/>`,
};

// Multiplier applied to stamp.size when placing in SVG coordinate space.
// At size=1.0 this makes the 40×32 stamp render as ≈60×48 SVG units.
export const STAMP_BASE_SCALE = 1.5;

const repo = createRepository<MapStamp>(
  'map_stamps',
  { size: 1.0 },
  [{ column: 'created_at', ascending: true }],
);

export function listStamps(bookId: string): Promise<MapStamp[]> {
  return repo.list(bookId);
}

export function createStamp(
  bookId: string,
  userId: string,
  type: StampType,
  x: number,
  y: number,
): Promise<MapStamp> {
  return repo.create(bookId, userId, { type, x, y });
}

export function updateStamp(id: string, patch: StampPatch): Promise<MapStamp> {
  return repo.update(id, patch);
}

export function deleteStamp(id: string): Promise<void> {
  return repo.delete(id);
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0035_map_stamps.sql src/lib/mapStamps.ts
git commit -m "feat(map): add map_stamps table + mapStamps lib"
```

---

## Task 3: Add `useStamps` to `src/lib/queries.ts`

**Files:**
- Modify: `src/lib/queries.ts`

- [ ] **Step 1: Add import at the top of the imports block**

After the existing `import { listConnections, type LocationConnection } from './connections';` line, add:

```typescript
import { listStamps, type MapStamp } from './mapStamps';
```

- [ ] **Step 2: Add key to `QUERY_KEYS`**

Inside the `QUERY_KEYS` object (after `connections:`):

```typescript
stamps: (bookId: string) => ['stamps', bookId] as const,
```

- [ ] **Step 3: Add `useStamps` hook**

After the existing `useConnections` function:

```typescript
export function useStamps(bookId: string | undefined) {
  return useQuery<MapStamp[]>(makeQuery(
    bookId ? QUERY_KEYS.stamps(bookId) : ['stamps', null],
    () => listStamps(bookId!),
    30_000,
  ));
}
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries.ts
git commit -m "feat(map): add useStamps query hook"
```

---

## Task 4: `src/components/MapStampsLayer.tsx`

**Files:**
- Create: `src/components/MapStampsLayer.tsx`

- [ ] **Step 1: Create the component**

```typescript
import { STAMP_SVG, STAMP_BASE_SCALE, type MapStamp, type StampType } from '../lib/mapStamps';

const CW = 1600;
const CH = 900;

interface MapStampsLayerProps {
  stamps: MapStamp[];
  selectedId: string | null;
  dragPos: { id: string; x: number; y: number } | null;
}

export function MapStampsLayer({ stamps, selectedId, dragPos }: MapStampsLayerProps) {
  return (
    <g>
      {stamps.map(stamp => {
        const isSelected = selectedId === stamp.id;
        const isDragging = dragPos?.id === stamp.id;
        const x = (isDragging ? dragPos!.x : stamp.x) * CW;
        const y = (isDragging ? dragPos!.y : stamp.y) * CH;
        const svgContent = STAMP_SVG[stamp.type as StampType] ?? '';

        return (
          <g
            key={stamp.id}
            data-stamp-id={stamp.id}
            transform={`translate(${x},${y}) scale(${stamp.size * STAMP_BASE_SCALE})`}
            style={{ cursor: 'pointer' }}
          >
            {isSelected && (
              <ellipse rx={24} ry={20} fill="var(--accent)" opacity={0.15} />
            )}
            <g
              transform="translate(-20,-16)"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
            {isSelected && (
              <ellipse rx={24} ry={20} fill="none" stroke="var(--accent)" strokeWidth={1.5} opacity={0.8} />
            )}
          </g>
        );
      })}
    </g>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/MapStampsLayer.tsx
git commit -m "feat(map): add MapStampsLayer SVG component"
```

---

## Task 5: `src/components/StampPopup.tsx`

**Files:**
- Create: `src/components/StampPopup.tsx`

- [ ] **Step 1: Create the component**

```typescript
import { STAMP_LABELS, STAMP_SVG, STAMP_TYPES, type MapStamp, type StampPatch, type StampType } from '../lib/mapStamps';

interface StampPopupProps {
  stamp: MapStamp;
  position: { left: number; top: number };
  onUpdate: (patch: StampPatch) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function StampPopup({ stamp, position, onUpdate, onDelete, onClose }: StampPopupProps) {
  return (
    <div
      style={{
        position: 'absolute', left: position.left, top: position.top,
        width: 248, background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '12px 14px',
        boxShadow: '0 6px 28px oklch(0 0 0 / 0.45)', zIndex: 20,
      }}
      onPointerDown={e => e.stopPropagation()}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ font: '500 10px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Штамп</span>
        <button
          onClick={onClose}
          aria-label="Закрыть"
          style={{ background: 'none', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 3px' }}
        >×</button>
      </div>

      <div style={{ font: '500 10px var(--font-mono)', color: 'var(--ink-4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Тип</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, marginBottom: 12 }}>
        {STAMP_TYPES.map(type => (
          <button
            key={type}
            type="button"
            onClick={() => onUpdate({ type })}
            title={STAMP_LABELS[type]}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: '4px 2px', borderRadius: 5, cursor: 'pointer', border: '1px solid',
              borderColor: stamp.type === type ? 'var(--accent)' : 'var(--border-soft)',
              background: stamp.type === type
                ? 'color-mix(in oklch, var(--accent) 12%, var(--surface-2))'
                : 'var(--surface-2)',
            }}
          >
            <svg width="22" height="17" viewBox="0 0 40 32">
              <g dangerouslySetInnerHTML={{ __html: STAMP_SVG[type as StampType] }} />
            </svg>
            <span style={{ font: '400 7px var(--font-ui)', color: 'var(--ink-3)', lineHeight: 1.2 }}>
              {STAMP_LABELS[type]}
            </span>
          </button>
        ))}
      </div>

      <div style={{ font: '500 10px var(--font-mono)', color: 'var(--ink-4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
        Размер {stamp.size.toFixed(1)}×
      </div>
      <input
        type="range"
        min={0.5} max={3.0} step={0.1}
        value={stamp.size}
        onChange={e => onUpdate({ size: parseFloat(e.target.value) })}
        style={{ width: '100%', marginBottom: 12 }}
      />

      <button
        className="btn btn--danger-ghost btn--sm"
        style={{ width: '100%' }}
        onClick={onDelete}
      >
        Удалить
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/StampPopup.tsx
git commit -m "feat(map): add StampPopup editor component"
```

---

## Task 6: Extend `src/pages/Map.tsx`

**Files:**
- Modify: `src/pages/Map.tsx`

- [ ] **Step 1: Add MapMode `'stamp'` and new imports**

Change:
```typescript
export type MapMode = 'place' | 'connect' | 'pan';
```
To:
```typescript
export type MapMode = 'place' | 'connect' | 'pan' | 'stamp';
```

Add to the existing import from `'../lib/queries'`:
```typescript
import { QUERY_KEYS, useBook, useLocations, useConnections, useStamps } from '../lib/queries';
```

Add new import block after the `updateBook` import:
```typescript
import {
  createStamp, updateStamp, deleteStamp,
  STAMP_LABELS, STAMP_SVG, STAMP_TYPES,
  type MapStamp, type StampPatch, type StampType,
} from '../lib/mapStamps';
```

- [ ] **Step 2: Add stamps data + state**

After the existing `useConnections` hook call:
```typescript
const { data: stamps = [] } = useStamps(bookId);
const [selectedStampType, setSelectedStampType] = useState<StampType>('mountain');
```

- [ ] **Step 3: Add stamp mutation handlers**

After the existing `onDeleteConfirmed` callback, add:

```typescript
const onCreateStamp = useCallback(async (x: number, y: number) => {
  if (!bookId || !user) return;
  try {
    const created = await createStamp(bookId, user.id, selectedStampType, x, y);
    queryClient.setQueryData<MapStamp[]>(QUERY_KEYS.stamps(bookId), prev =>
      [...(prev ?? []), created]
    );
  } catch (e) { setError((e as Error).message); }
}, [bookId, user, selectedStampType, queryClient, setError]);

const onUpdateStamp = useCallback(async (id: string, patch: StampPatch) => {
  if (!bookId) return;
  queryClient.setQueryData<MapStamp[]>(QUERY_KEYS.stamps(bookId), prev =>
    prev ? prev.map(s => s.id === id ? { ...s, ...patch } as MapStamp : s) : prev
  );
  try {
    const updated = await updateStamp(id, patch);
    queryClient.setQueryData<MapStamp[]>(QUERY_KEYS.stamps(bookId), prev =>
      prev ? prev.map(s => s.id === id ? updated : s) : prev
    );
  } catch (e) {
    setError((e as Error).message);
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stamps(bookId) });
  }
}, [bookId, queryClient, setError]);

const onDeleteStamp = useCallback(async (id: string) => {
  if (!bookId) return;
  queryClient.setQueryData<MapStamp[]>(QUERY_KEYS.stamps(bookId), prev =>
    prev ? prev.filter(s => s.id !== id) : prev
  );
  try {
    await deleteStamp(id);
  } catch (e) {
    setError((e as Error).message);
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stamps(bookId) });
  }
}, [bookId, queryClient, setError]);
```

- [ ] **Step 4: Add stamp mode button to `modeButtons`**

Change:
```typescript
const modeButtons: { value: MapMode; icon: string; label: string }[] = [
  { value: 'place',   icon: '📍', label: 'Место' },
  { value: 'connect', icon: '↔',  label: 'Связь' },
  { value: 'pan',     icon: '✋', label: 'Перемещение' },
];
```
To:
```typescript
const modeButtons: { value: MapMode; icon: string; label: string }[] = [
  { value: 'place',   icon: '📍', label: 'Место' },
  { value: 'connect', icon: '↔',  label: 'Связь' },
  { value: 'pan',     icon: '✋', label: 'Перемещение' },
  { value: 'stamp',   icon: '🖌',  label: 'Рельеф' },
];
```

- [ ] **Step 5: Add stamp type picker in sidebar**

After the closing `</div>` of the modeButtons `.map(...)` block inside `<Sidebar>`, add:

```typescript
{mode === 'stamp' && (
  <div style={{ marginTop: 8 }}>
    <div style={{ font: '500 10px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Тип</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4 }}>
      {STAMP_TYPES.map(type => (
        <button
          key={type}
          type="button"
          onClick={() => setSelectedStampType(type)}
          className={'sb-item' + (selectedStampType === type ? ' sb-item--on' : '')}
          aria-pressed={selectedStampType === type}
          style={{ cursor: 'pointer', justifyContent: 'flex-start', gap: 6 }}
        >
          <svg width="20" height="16" viewBox="0 0 40 32" style={{ flexShrink: 0 }}>
            <g dangerouslySetInnerHTML={{ __html: STAMP_SVG[type] }} />
          </svg>
          <span className="sb-item-title" style={{ fontSize: 11 }}>{STAMP_LABELS[type]}</span>
        </button>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 6: Pass stamps props to `<WorldMap>`**

Update the `<WorldMap ... />` call. Find the existing props block and add:

```typescript
stamps={stamps}
selectedStampType={selectedStampType}
onCreateStamp={(x, y) => { void onCreateStamp(x, y); }}
onUpdateStamp={onUpdateStamp}
onDeleteStamp={(id) => { void onDeleteStamp(id); }}
```

- [ ] **Step 7: Pass stamps to `onExportPng`**

Change the `generateMapPngBuffer` call from:
```typescript
const buffer = await generateMapPngBuffer(book, locations, connections);
```
To:
```typescript
const buffer = await generateMapPngBuffer(book, locations, connections, stamps);
```

Add `stamps` to the dependency array of the `onExportPng` useCallback.

- [ ] **Step 8: Run typecheck**

```bash
npm run typecheck
```

Expected: errors about missing WorldMap props — these will be fixed in Task 7.

- [ ] **Step 9: Commit (after Task 7 passes typecheck)**

```bash
git add src/pages/Map.tsx
git commit -m "feat(map): add stamp mode to Map.tsx — handlers, sidebar picker"
```

---

## Task 7: Extend `src/components/WorldMap.tsx`

**Files:**
- Modify: `src/components/WorldMap.tsx`

- [ ] **Step 1: Add new imports**

At the top of the file, add:
```typescript
import { MapStampsLayer } from './MapStampsLayer';
import { StampPopup } from './StampPopup';
import { type MapStamp, type StampPatch, type StampType } from '../lib/mapStamps';
```

- [ ] **Step 2: Extend `WorldMapProps`**

Add to the interface after `onUpdateConnection`:
```typescript
stamps: MapStamp[];
selectedStampType: StampType;
onCreateStamp: (x: number, y: number) => void;
onUpdateStamp: (id: string, patch: StampPatch) => void;
onDeleteStamp: (id: string) => void;
```

- [ ] **Step 3: Destructure new props**

In the `export function WorldMap({...})` signature, add the new props after `onUpdateConnection`:
```typescript
stamps, selectedStampType,
onCreateStamp, onUpdateStamp, onDeleteStamp,
```

- [ ] **Step 4: Add stamp interaction state and refs**

After the existing `const [dragPinPos, ...]` line, add:
```typescript
const [selectedStampId, setSelectedStampId] = useState<string | null>(null);
const [dragStampPos, setDragStampPos] = useState<{ id: string; x: number; y: number } | null>(null);
const stampDragRef = useRef<{ id: string; startPX: number; startPY: number } | null>(null);
```

- [ ] **Step 5: Reset stamp selection on mode change**

After the existing `useEffect` that resets `connectFrom` on mode change, add:
```typescript
useEffect(() => {
  if (mode !== 'stamp') setSelectedStampId(null);
}, [mode]);
```

- [ ] **Step 6: Add stamp ID to Escape handler**

Find the existing `useEffect` for Escape key and add `setSelectedStampId(null)`:
```typescript
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    setPendingPlaceId(null);
    setConnectFrom(null);
    setSelectedId(null);
    setSelectedConnId(null);
    setSelectedStampId(null);   // ← add this line
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, []);
```

- [ ] **Step 7: Replace `onPointerDown`**

Replace the entire `onPointerDown` function:

```typescript
const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
  if (e.button !== 0) return;
  const target = e.target as Element;
  const stampEl = target.closest('[data-stamp-id]');
  const locEl   = target.closest('[data-loc-id]');

  if (mode === 'stamp' && stampEl) {
    const id = stampEl.getAttribute('data-stamp-id')!;
    e.currentTarget.setPointerCapture(e.pointerId);
    const stamp = stamps.find(s => s.id === id);
    if (!stamp) return;
    stampDragRef.current = { id, startPX: e.clientX, startPY: e.clientY };
    setDragStampPos({ id, x: stamp.x, y: stamp.y });
    return;
  }

  if (locEl && mode !== 'stamp') {
    const id = locEl.getAttribute('data-loc-id')!;
    if (mode === 'connect') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const loc = locations.find(l => l.id === id);
    if (!loc || loc.x == null || loc.y == null) return;
    pinDragRef.current = { id, startPX: e.clientX, startPY: e.clientY };
    setDragPinPos({ id, x: loc.x, y: loc.y });
  } else {
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedId(null);
    setSelectedConnId(null);
    setSelectedStampId(null);
    panRef.current = { px: e.clientX, py: e.clientY, ox: panValRef.current.x, oy: panValRef.current.y };
  }
};
```

- [ ] **Step 8: Replace `onPointerMove`**

Replace the entire `onPointerMove` function:

```typescript
const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
  if (stampDragRef.current) {
    const { x, y } = getLogical(e.clientX, e.clientY);
    setDragStampPos({ id: stampDragRef.current.id, x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) });
  } else if (pinDragRef.current) {
    const { x, y } = getLogical(e.clientX, e.clientY);
    setDragPinPos({ id: pinDragRef.current.id, x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) });
  } else if (panRef.current) {
    setPan({ x: panRef.current.ox + (e.clientX - panRef.current.px), y: panRef.current.oy + (e.clientY - panRef.current.py) });
  }
};
```

- [ ] **Step 9: Replace `onPointerUp`**

Replace the entire `onPointerUp` function:

```typescript
const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
  const target = e.target as Element;
  const locEl  = target.closest('[data-loc-id]');
  const connEl = target.closest('[data-conn-id]');

  if (stampDragRef.current) {
    const { id, startPX, startPY } = stampDragRef.current;
    const dragged = Math.abs(e.clientX - startPX) > DRAG_THRESHOLD || Math.abs(e.clientY - startPY) > DRAG_THRESHOLD;
    if (dragged && dragStampPos) {
      onUpdateStamp(id, { x: dragStampPos.x, y: dragStampPos.y });
    } else {
      setSelectedStampId(prev => prev === id ? null : id);
    }
    stampDragRef.current = null;
    setDragStampPos(null);
    return;
  }

  if (pinDragRef.current) {
    const { id, startPX, startPY } = pinDragRef.current;
    const dragged = Math.abs(e.clientX - startPX) > DRAG_THRESHOLD || Math.abs(e.clientY - startPY) > DRAG_THRESHOLD;
    if (dragged && dragPinPos) {
      onUpdate(id, { x: dragPinPos.x, y: dragPinPos.y });
    } else if (mode === 'place') {
      setSelectedId(prev => prev === id ? null : id);
      setSelectedConnId(null);
    }
    pinDragRef.current = null;
    setDragPinPos(null);
    return;
  }

  if (mode === 'connect' && locEl) {
    const id = locEl.getAttribute('data-loc-id')!;
    if (!connectFrom) {
      setConnectFrom(id);
    } else if (connectFrom !== id) {
      onCreateConnection(connectFrom, id);
      setConnectFrom(null);
    }
    return;
  }

  if (panRef.current) {
    const dx = Math.abs(e.clientX - panRef.current.px);
    const dy = Math.abs(e.clientY - panRef.current.py);
    if (dx <= DRAG_THRESHOLD && dy <= DRAG_THRESHOLD) {
      if (connEl && mode !== 'stamp') {
        const id = connEl.getAttribute('data-conn-id')!;
        setSelectedConnId(prev => prev === id ? null : id);
        setSelectedId(null);
      } else if (mode === 'stamp') {
        const { x, y } = getLogical(e.clientX, e.clientY);
        if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
          onCreateStamp(x, y);
        }
      } else if (mode === 'connect') {
        setConnectFrom(null);
      } else if (mode === 'place') {
        const { x, y } = getLogical(e.clientX, e.clientY);
        if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
          if (pendingPlaceId) {
            onUpdate(pendingPlaceId, { x, y });
            setPendingPlaceId(null);
          } else {
            onCreate(x, y);
          }
        }
      }
    }
    panRef.current = null;
  }
};
```

- [ ] **Step 10: Extend hint text**

Find the `const hintText = ...` block and prepend a stamp case:

```typescript
const hintText = mode === 'stamp'
  ? 'Кликните на карту чтобы поставить штамп · тяните штамп для перемещения'
  : mode === 'connect'
  ? connectFrom
    ? `«${locations.find(l => l.id === connectFrom)?.name ?? '…'}» → кликните вторую локацию · Esc отмена`
    : 'Режим «Связь» — кликните первую локацию'
  : mode === 'pan'
  ? 'Перетащите карту · колесо мыши — zoom'
  : pendingPlaceId
  ? 'Кликните на карту чтобы разместить · Esc отмена'
  : 'Кликните на карту чтобы добавить локацию';
```

- [ ] **Step 11: Add cursor for stamp mode**

Find the `cursor:` prop on the canvas `div` and update:

```typescript
cursor: mode === 'connect' ? 'crosshair' : mode === 'stamp' ? 'cell' : pendingPlaceId ? 'cell' : 'default'
```

- [ ] **Step 12: Add `<MapStampsLayer>` inside the SVG**

Inside the `<svg>` element, after the background block (`{bgUrl ? ... : <TemplateBg .../>}`) and **before** the connections block, insert:

```typescript
{/* Stamps — below connections and pins */}
<MapStampsLayer
  stamps={stamps}
  selectedId={selectedStampId}
  dragPos={dragStampPos}
/>
```

- [ ] **Step 13: Add stamp popup and derive its position**

After the existing popup position derivation (`popupLeft`, `popupTop`), add:

```typescript
const selectedStamp = selectedStampId ? stamps.find(s => s.id === selectedStampId) ?? null : null;
const stampPopupLeft = selectedStamp?.x != null
  ? Math.min(Math.max(selectedStamp.x * CW * scale + pan.x + 20, 8), containerW - 260)
  : 0;
const stampPopupTop = selectedStamp?.y != null
  ? Math.max(Math.min(selectedStamp.y * CH * scale + pan.y - 80, containerH - 280), 8)
  : 0;
```

Then, inside the canvas `div`, after the `{!isMobile && selected && ...}` location popup block, add:

```typescript
{!isMobile && selectedStamp && (
  <StampPopup
    stamp={selectedStamp}
    position={{ left: stampPopupLeft, top: stampPopupTop }}
    onUpdate={patch => onUpdateStamp(selectedStamp.id, patch)}
    onDelete={() => {
      onDeleteStamp(selectedStamp.id);
      setSelectedStampId(null);
    }}
    onClose={() => setSelectedStampId(null)}
  />
)}
```

- [ ] **Step 14: Run typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 15: Commit**

```bash
git add src/components/WorldMap.tsx src/pages/Map.tsx
git commit -m "feat(map): integrate stamps layer and popup into WorldMap"
```

---

## Task 8: Extend `src/lib/mapExport.ts`

**Files:**
- Modify: `src/lib/mapExport.ts`

- [ ] **Step 1: Add import**

Add to the existing imports at the top:
```typescript
import { STAMP_SVG, STAMP_BASE_SCALE, type MapStamp, type StampType } from './mapStamps';
```

- [ ] **Step 2: Add `buildStampsSvg` helper**

Add this function after the `escXml` helper function:

```typescript
function buildStampsSvg(stamps: MapStamp[]): string {
  return stamps.map(s => {
    const x = s.x * CW;
    const y = s.y * CH;
    const inner = STAMP_SVG[s.type as StampType] ?? '';
    return `<g transform="translate(${x},${y}) scale(${s.size * STAMP_BASE_SCALE})"><g transform="translate(-20,-16)">${inner}</g></g>`;
  }).join('\n');
}
```

- [ ] **Step 3: Add `stamps` parameter to `buildSvgString`**

Change the signature:
```typescript
function buildSvgString(
  book: Book,
  locations: Location[],
  connections: LocationConnection[],
  stamps: MapStamp[],   // ← add
  bgDataUrl: string | null,
): string {
```

And inside the function, insert the stamps layer between bg and connections:

```typescript
  const stampsSvg = buildStampsSvg(stamps);

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}">
${bg}
${stampsSvg}
${connsSvg}
${pinsSvg}
</svg>`;
```

(Replace the existing return statement.)

- [ ] **Step 4: Add `stamps` parameter to `generateMapPngBuffer`**

Change the signature:
```typescript
export async function generateMapPngBuffer(
  book: Book,
  locations: Location[],
  connections: LocationConnection[],
  stamps: MapStamp[] = [],   // ← add with default
): Promise<ArrayBuffer> {
```

And update the internal call to `buildSvgString`:
```typescript
const svgStr = buildSvgString(book, locations, connections, stamps, bgDataUrl);
```

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors. (The `stamps` param in Map.tsx already passes it; with the `= []` default, existing callers without stamps also compile.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/mapExport.ts
git commit -m "feat(map): include stamps layer in PNG export"
```

---

## Task 9: Manual smoke test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Open `http://127.0.0.1:5273` and navigate to any book's map page.

- [ ] **Step 2: Test stamp placement**
  - Click "Рельеф" in sidebar → mode switches, stamp type grid appears
  - Select "Горы"
  - Click on the map → mountain stamp appears at click point
  - Click elsewhere → another stamp appears

- [ ] **Step 3: Test stamp editing**
  - Click on an existing stamp → StampPopup appears with type grid and size slider
  - Change type to "Лес" → stamp changes shape
  - Move size slider → stamp grows/shrinks
  - Press Escape → popup closes

- [ ] **Step 4: Test stamp drag**
  - Click and drag a stamp → it moves
  - Release → position is persisted (refresh to verify)

- [ ] **Step 5: Test PNG export**
  - Place several stamps
  - Click "PNG" button in toolbar → downloaded image includes stamps

- [ ] **Step 6: Test connection/place modes still work**
  - Switch to "Место" mode → pins still clickable, stamp popup does not open
  - Switch to "Связь" mode → connection creation still works

---

## Task 10: Docs + final checks

**Files:**
- Modify: `docs/features/maps.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update `docs/features/maps.md`**

Append this section at the end of the file:

```markdown
## Штампы (MapStamps)

- Таблица `map_stamps`: `type` (StampType), `x` (float 0–1), `y` (float 0–1), `size` (float 0.5–3.0).
- Миграция: `0035_map_stamps.sql`.
- Lib: `src/lib/mapStamps.ts` — types, `STAMP_SVG`, `STAMP_LABELS`, CRUD via `createRepository`.
- Компоненты: `MapStampsLayer.tsx` (SVG-слой), `StampPopup.tsx` (редактирование).
- Режим `'stamp'` в `MapMode`: клик → создать штамп; тянуть → переместить; клик по штампу → попап.
- Штампы рендерятся ниже связей и пинов в SVG-слоях.
- Экспорт PNG: `buildStampsSvg()` в `mapExport.ts` — генерирует SVG без CSS-переменных.
```

- [ ] **Step 2: Update `CLAUDE.md` component registry**

In the `### Компоненты` section, add after `CharacterHoverCard.tsx`:
```
- `src/components/MapStampsLayer.tsx` — SVG-слой штампов карты: рендер всех штампов с drag-состоянием и selection ring; получает stamps[], selectedId, dragPos.
- `src/components/StampPopup.tsx` — попап редактирования штампа: пикер типа (5×2 grid), слайдер размера, удаление; закрывается по Escape и клику за пределами.
```

In the `### lib/` section, add after `mapExport.ts`:
```
- `src/lib/mapStamps.ts` — `StampType`, `MapStamp`, `STAMP_SVG` (10 типов), `STAMP_LABELS`, `STAMP_BASE_SCALE`; CRUD через `createRepository`; используется в MapStampsLayer, StampPopup, mapExport.
```

- [ ] **Step 3: Final typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Final commit**

```bash
git add docs/features/maps.md CLAUDE.md
git commit -m "docs: register map stamps components and update maps feature doc"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `map_stamps` table with RLS + index + GRANT | Task 1 |
| 10 StampType values | Task 2 |
| `river` as connection style | Already done — skipped |
| `createStamp/updateStamp/deleteStamp` | Task 2 |
| `QUERY_KEYS.stamps` + `useStamps` | Task 3 |
| `MapStampsLayer` SVG component | Task 4 |
| `StampPopup` with type grid + slider + delete | Task 5 |
| `MapMode` extended with `'stamp'` | Task 6 |
| Stamp type picker in sidebar | Task 6 |
| `onCreateStamp/onUpdateStamp/onDeleteStamp` handlers | Task 6 |
| WorldMap: stamps layer before connections | Task 7 step 12 |
| WorldMap: click in stamp mode → create | Task 7 step 9 |
| WorldMap: drag stamp → move | Task 7 steps 7–9 |
| WorldMap: click stamp → popup | Task 7 steps 7–9, 13 |
| Escape closes popup | Task 7 step 6 |
| Stamps in PNG export | Task 8 |
| `CLAUDE.md` + `docs/features/maps.md` update | Task 10 |

**Placeholder scan:** None found.

**Type consistency check:**
- `StampPatch` defined in Task 2, used identically in Tasks 6, 7
- `MapStamp` interface used consistently across all tasks
- `STAMP_BASE_SCALE` exported from Task 2, imported in Tasks 4 and 8
- `onUpdateStamp(id, patch)` signature: same in Task 6 (handler), Task 7 (WorldMap prop + StampPopup call)

**Known limitation:** Stamps render below pins in SVG z-order. In stamp mode, clicking on an area covered by a pin activates the pin interaction path (no stamp is targeted). This is acceptable for MVP — users should click on empty map areas to stamp.
