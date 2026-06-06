# Editor Font Picker — Design Spec

**Date:** 2026-06-06
**Status:** Approved

---

## Summary

Add a font selector for the editor. Writers spend hours in the editor; the choice of typeface directly affects their relationship with the text. Five curated fonts with Cyrillic support, exposed in two places: Settings (persistent preference) and StatusBar (quick switcher mid-session).

---

## Font Pool

| ID | Pill label | Full name | CSS family | Character |
|----|-----------|-----------|------------|-----------|
| `source-serif-4` | Source Serif | Source Serif 4 | `'Source Serif 4', Georgia, serif` | Modern, clean — **default** |
| `lora` | Lora | Lora | `'Lora', Georgia, serif` | Warm, intimate — fiction |
| `pt-serif` | PT Serif | PT Serif | `'PT Serif', Georgia, serif` | Classic Russian literary feel |
| `spectral` | Spectral | Spectral | `'Spectral', Georgia, serif` | Editorial, elegant — essays |
| `ibm-plex-mono` | Mono | IBM Plex Mono | `'IBM Plex Mono', monospace` | Typewriter/draft mode |

All fonts loaded from Google Fonts CDN via `<link>` in `index.html`. Source Serif 4 and IBM Plex Mono are already loaded.

---

## Storage & Application

New file `src/lib/editorFont.ts` — mirrors the pattern of `src/lib/theme.ts`:

- `EDITOR_FONTS` — typed array of `{ id, label, fullName, family }` entries
- `getStoredEditorFont()` — reads `localStorage` key `as-editor-font`, falls back to `'source-serif-4'`
- `applyEditorFont(id)` — sets CSS custom property `--font-editor` on `document.documentElement` + writes to `localStorage`

CSS variable `--font-editor` is declared in `src/styles/design-system.css` with the default value, and applied to the `.ProseMirror` selector (TipTap's editor root class).

On app startup (`src/main.tsx`), call `applyEditorFont(getStoredEditorFont())` — same pattern as `applyTheme`.

---

## A — SettingsModal (Interface tab)

Location: `src/components/SettingsModal.tsx`, tab `interface`.

Added below the existing "Тема" row, separated by a `<div style={{ height: 1, background: 'var(--border-soft)' }} />` divider.

**Layout:**
```
Шрифт редактора
Используется при наборе текста в редакторе

[ Source Serif ]  [ Lora ]  [ PT Serif ]  [ Spectral ]  [ Mono ]

┌─────────────────────────────────────────┐
│ Source Serif 4 · предпросмотр           │
│                                         │
│ Она вошла тихо, как входят люди,        │
│ которые боятся спугнуть что-то хрупкое. │
│ Письмо было всё ещё на столе.           │
└─────────────────────────────────────────┘
```

**Pills:** each pill renders its label in its own font-family (inline `style`). Active pill: `border-color: var(--accent)`, `background: var(--accent-soft)`. Height 30px, padding `0 12px`, `border-radius: 7px`, `font-size: 13px`, `flex-wrap: nowrap`.

**Preview strip:** `background: var(--bg-deep)`, `border: 1px solid var(--border-soft)`, `border-radius: 10px`, padding `14px 16px`. Contains:
- Label line: font-size 10px, `var(--font-mono)`, uppercase, `color: var(--ink-4)` — shows full font name + "· предпросмотр"
- Body text: same sample phrase rendered at `font-size: 17px`, `line-height: 1.78` (editor values), `color: var(--ink-2)`, `font-style` includes an `<em>` segment. `transition: font-family 0.2s ease`.

Clicking a pill calls `applyEditorFont(id)` and updates local `activeFont` state. No separate save button — instant apply, same as theme switching.

---

## B — StatusBar (quick switcher)

Location: `src/components/StatusBar.tsx`.

**Button order on the right side (after `flex: 1`):**
```
сегодня · N/N слов  ·  серия N дней   [⊙ фокус]  [Aa шрифт]  [🎧 звуки]
```

Rationale: focus and font both affect the visual writing experience; sounds are a separate ambient layer — goes last.

**Aa button:** `width: 22px`, `height: 22px`, same `status-btn` class as existing buttons. Content: `<span>` with text `"Aa"`, `font-size: 12px`, `font-weight: 500`, `font-family: var(--font-ui)`. Color: `var(--ink-3)` default, `var(--accent)` when popover is open. Title: `"Шрифт редактора"`.

**Popover:** opens on click, closes on outside click (same pattern as sounds popover — `useEffect` + `mousedown` listener on `wrapperRef`). Positioning: `position: absolute; bottom: calc(100% + 8px); right: 0` by default (opens upward, right-aligned). Uses `useDropdownPosition` hook to flip direction if there is insufficient space above.

Popover appearance: `width: 180px`, `background: var(--surface)`, `border: 1px solid var(--border-soft)`, `border-radius: 8px`, `padding: 6px`, `box-shadow` matching existing dropdowns, `animation: dropdown-in`.

Each item: full-width row, font name rendered in its own font-family, `font-size: 13px`, `padding: 7px 10px`, `border-radius: 6px`. Active item shows `✓` on the right in `var(--accent)`. Clicking an item calls `applyEditorFont(id)`, closes the popover.

StatusBar reads initial font from `getStoredEditorFont()` for its local display state. `applyEditorFont()` in `editorFont.ts` dispatches `window.dispatchEvent(new CustomEvent('as-editor-font', { detail: id }))` after applying the CSS var. Both StatusBar and SettingsModal subscribe to this event (`useEffect` with `addEventListener('as-editor-font', ...)`) to keep their active-font display state in sync — same pattern as how `applyTheme` works globally without prop drilling.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/editorFont.ts` | **New** — font definitions, storage, CSS apply |
| `src/styles/design-system.css` | Add `--font-editor` var + `.ProseMirror` rule |
| `index.html` | Add Google Fonts `<link>` for PT Serif, Lora, Spectral |
| `src/main.tsx` | Call `applyEditorFont(getStoredEditorFont())` on boot |
| `src/components/SettingsModal.tsx` | Font picker in Interface tab |
| `src/components/StatusBar.tsx` | Aa button + popover, reorder right-side buttons |

---

## Out of Scope

- Font size and line-height controls (separate feature if needed later)
- Per-book font (global user preference only)
- Custom font upload
