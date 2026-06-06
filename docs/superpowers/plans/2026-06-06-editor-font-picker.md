# Editor Font Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a font selector for the TipTap editor — 5 curated Cyrillic fonts, persisted in localStorage, switchable from SettingsModal (Interface tab) and a quick StatusBar popover.

**Architecture:** New `editorFont.ts` module mirrors `theme.ts` (localStorage + CSS custom property + window event for cross-component sync). CSS variable `--font-editor` on `:root` controls `.sheet` and `.tiptap` headings. SettingsModal shows pills + live preview; StatusBar adds an «Aa» button between the focus and sounds buttons.

**Tech Stack:** React, TypeScript strict, @fontsource npm packages, CSS custom properties, window CustomEvent

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/editorFont.ts` | **Create** | Font definitions, localStorage, CSS var, event dispatch |
| `src/main.tsx` | **Modify** | Install font CSS imports; call applyEditorFont on boot |
| `src/styles/design-system.css` | **Modify** | Add `--font-editor` var; point `.sheet` and `.tiptap h1/h2/h3` at it |
| `src/components/SettingsModal.tsx` | **Modify** | Font pills + live preview in Interface tab |
| `src/components/StatusBar.tsx` | **Modify** | Aa button + popover; reorder: focus → Aa → sounds |
| `docs/features/editor.md` | **Modify** | Document font setting |
| `CLAUDE.md` | **Modify** | Add editorFont.ts to Architecture section |

---

## Task 1: Install font packages and add imports

**Files:**
- Modify: `src/main.tsx` (lines 1–13, after existing @fontsource imports)

- [ ] **Step 1: Install the three new font packages**

```bash
npm install @fontsource/lora @fontsource/pt-serif @fontsource/spectral
```

Expected: packages added to `node_modules/`, no errors.

- [ ] **Step 2: Add Cyrillic CSS imports to main.tsx**

In `src/main.tsx`, add these six lines immediately after the existing `@fontsource/ibm-plex-mono/latin-500.css` import and before the `@fontsource-variable/source-serif-4` line:

```typescript
import '@fontsource/lora/cyrillic-400.css';
import '@fontsource/lora/cyrillic-400-italic.css';
import '@fontsource/pt-serif/cyrillic-400.css';
import '@fontsource/pt-serif/cyrillic-400-italic.css';
import '@fontsource/spectral/cyrillic-400.css';
import '@fontsource/spectral/cyrillic-400-italic.css';
```

- [ ] **Step 3: Verify build doesn't break**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/main.tsx package.json package-lock.json
git commit -m "feat(fonts): install Lora, PT Serif, Spectral via @fontsource"
```

---

## Task 2: Create `src/lib/editorFont.ts`

**Files:**
- Create: `src/lib/editorFont.ts`

- [ ] **Step 1: Create the module**

Create `src/lib/editorFont.ts` with this exact content:

```typescript
export type EditorFontId = 'source-serif-4' | 'lora' | 'pt-serif' | 'spectral' | 'ibm-plex-mono';

export interface EditorFont {
  id: EditorFontId;
  label: string;
  fullName: string;
  family: string;
}

export const EDITOR_FONTS: EditorFont[] = [
  { id: 'source-serif-4', label: 'Source Serif', fullName: 'Source Serif 4', family: "'Source Serif 4', Georgia, serif" },
  { id: 'lora',           label: 'Lora',         fullName: 'Lora',           family: "'Lora', Georgia, serif" },
  { id: 'pt-serif',       label: 'PT Serif',      fullName: 'PT Serif',       family: "'PT Serif', Georgia, serif" },
  { id: 'spectral',       label: 'Spectral',      fullName: 'Spectral',       family: "'Spectral', Georgia, serif" },
  { id: 'ibm-plex-mono',  label: 'Mono',          fullName: 'IBM Plex Mono',  family: "'IBM Plex Mono', monospace" },
];

const STORAGE_KEY = 'as-editor-font';
export const EDITOR_FONT_EVENT = 'as-editor-font';
const DEFAULT_ID: EditorFontId = 'source-serif-4';

export function getStoredEditorFont(): EditorFontId {
  return (localStorage.getItem(STORAGE_KEY) as EditorFontId | null) ?? DEFAULT_ID;
}

export function applyEditorFont(id: EditorFontId): void {
  const font = EDITOR_FONTS.find(f => f.id === id) ?? EDITOR_FONTS[0];
  document.documentElement.style.setProperty('--font-editor', font.family);
  localStorage.setItem(STORAGE_KEY, id);
  window.dispatchEvent(new CustomEvent(EDITOR_FONT_EVENT, { detail: id }));
}
```

- [ ] **Step 2: Verify types**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/editorFont.ts
git commit -m "feat(fonts): add editorFont module — definitions, localStorage, CSS var, event"
```

---

## Task 3: Update `design-system.css` — add `--font-editor` and wire selectors

**Files:**
- Modify: `src/styles/design-system.css`

- [ ] **Step 1: Add `--font-editor` CSS variable to `:root`**

Find this block (around line 59–61):
```css
  --font-ui: 'IBM Plex Sans', system-ui, sans-serif;
  --font-serif: 'Source Serif 4', Georgia, serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
```

Replace with:
```css
  --font-ui: 'IBM Plex Sans', system-ui, sans-serif;
  --font-serif: 'Source Serif 4', Georgia, serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
  --font-editor: 'Source Serif 4', Georgia, serif;
```

- [ ] **Step 2: Point `.sheet` body text at `--font-editor`**

Find:
```css
  font-family: var(--font-serif);
  font-size: 17px; line-height: 1.78;
  padding: 56px 72px 80px;
```

Replace with:
```css
  font-family: var(--font-editor);
  font-size: 17px; line-height: 1.78;
  padding: 56px 72px 80px;
```

- [ ] **Step 3: Point `.sheet h1, .sheet .ch-num, .sheet .ch-title` at `--font-editor`**

Find:
```css
.sheet h1, .sheet .ch-num, .sheet .ch-title {
  font-family: var(--font-serif);
```

Replace with:
```css
.sheet h1, .sheet .ch-num, .sheet .ch-title {
  font-family: var(--font-editor);
```

- [ ] **Step 4: Point TipTap headings at `--font-editor`**

Find:
```css
.tiptap h1 { font: 600 30px var(--font-serif); letter-spacing: -0.012em; margin: 1.2em 0 0.6em; }
.tiptap h2 { font: 600 22px var(--font-serif); letter-spacing: -0.01em; margin: 1.4em 0 0.5em; }
.tiptap h3 { font: 600 17px var(--font-serif); margin: 1.2em 0 0.5em; }
```

Replace with:
```css
.tiptap h1 { font: 600 30px var(--font-editor); letter-spacing: -0.012em; margin: 1.2em 0 0.6em; }
.tiptap h2 { font: 600 22px var(--font-editor); letter-spacing: -0.01em; margin: 1.4em 0 0.5em; }
.tiptap h3 { font: 600 17px var(--font-editor); margin: 1.2em 0 0.5em; }
```

- [ ] **Step 5: Verify build**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/styles/design-system.css
git commit -m "feat(fonts): add --font-editor CSS var, wire .sheet and .tiptap headings"
```

---

## Task 4: Initialize font on app boot

**Files:**
- Modify: `src/main.tsx`

- [ ] **Step 1: Add import and boot call**

In `src/main.tsx`, find:
```typescript
import { applyTheme, getStoredTheme } from './lib/theme';

// Применяем до рендера, чтобы не было мигания темы
applyTheme(getStoredTheme());
```

Replace with:
```typescript
import { applyTheme, getStoredTheme } from './lib/theme';
import { applyEditorFont, getStoredEditorFont } from './lib/editorFont';

// Применяем до рендера, чтобы не было мигания темы и шрифта
applyTheme(getStoredTheme());
applyEditorFont(getStoredEditorFont());
```

- [ ] **Step 2: Verify**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/main.tsx
git commit -m "feat(fonts): apply stored editor font on boot before render"
```

---

## Task 5: Font picker in SettingsModal (Interface tab)

**Files:**
- Modify: `src/components/SettingsModal.tsx`

- [ ] **Step 1: Add import at the top of the file**

Find the existing imports block. After:
```typescript
import { applyTheme, getStoredTheme, type Theme } from '../lib/theme';
```

Add:
```typescript
import { EDITOR_FONTS, getStoredEditorFont, applyEditorFont, EDITOR_FONT_EVENT, type EditorFontId } from '../lib/editorFont';
```

- [ ] **Step 2: Add font state and handler inside `SettingsModal`**

Find:
```typescript
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
```

Replace with:
```typescript
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  const [activeFont, setActiveFont] = useState<EditorFontId>(getStoredEditorFont);
```

- [ ] **Step 3: Add font event listener (for sync with StatusBar)**

Find:
```typescript
  const handleTheme = (next: Theme) => {
    setTheme(next);
    applyTheme(next);
  };
```

Replace with:
```typescript
  const handleTheme = (next: Theme) => {
    setTheme(next);
    applyTheme(next);
  };

  const handleFont = (id: EditorFontId) => {
    setActiveFont(id);
    applyEditorFont(id);
  };
```

- [ ] **Step 4: Add useEffect to sync with StatusBar changes**

Find the closing brace of the `handleFont` function you just added:
```typescript
  const handleFont = (id: EditorFontId) => {
    setActiveFont(id);
    applyEditorFont(id);
  };
```

Add after it:
```typescript
  useEffect(() => {
    const handler = (e: Event) => setActiveFont((e as CustomEvent<EditorFontId>).detail);
    window.addEventListener(EDITOR_FONT_EVENT, handler);
    return () => window.removeEventListener(EDITOR_FONT_EVENT, handler);
  }, []);
```

- [ ] **Step 5: Replace the Interface tab content**

Find:
```tsx
            {activeTab === 'interface' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ font: '500 13px var(--font-ui)', color: 'var(--ink)', marginBottom: 2 }}>Тема</div>
                    <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)' }}>Оформление интерфейса</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => handleTheme('dark')}
                      className={'btn' + (theme === 'dark' ? ' btn--primary' : ' btn--ghost')}
                      style={{ fontSize: 12, gap: 5 }}
                    >
                      <Icon name="moon" size={13} /> Тёмная
                    </button>
                    <button
                      onClick={() => handleTheme('light')}
                      className={'btn' + (theme === 'light' ? ' btn--primary' : ' btn--ghost')}
                      style={{ fontSize: 12, gap: 5 }}
                    >
                      <Icon name="sun" size={13} /> Светлая
                    </button>
                  </div>
                </div>
              </div>
            )}
```

Replace with:
```tsx
            {activeTab === 'interface' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ font: '500 13px var(--font-ui)', color: 'var(--ink)', marginBottom: 2 }}>Тема</div>
                    <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)' }}>Оформление интерфейса</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => handleTheme('dark')}
                      className={'btn' + (theme === 'dark' ? ' btn--primary' : ' btn--ghost')}
                      style={{ fontSize: 12, gap: 5 }}
                    >
                      <Icon name="moon" size={13} /> Тёмная
                    </button>
                    <button
                      onClick={() => handleTheme('light')}
                      className={'btn' + (theme === 'light' ? ' btn--primary' : ' btn--ghost')}
                      style={{ fontSize: 12, gap: 5 }}
                    >
                      <Icon name="sun" size={13} /> Светлая
                    </button>
                  </div>
                </div>

                <div style={{ height: 1, background: 'var(--border-soft)' }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <div style={{ font: '500 13px var(--font-ui)', color: 'var(--ink)', marginBottom: 2 }}>Шрифт редактора</div>
                    <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)' }}>Используется при наборе текста</div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'nowrap' }}>
                    {EDITOR_FONTS.map(f => (
                      <button
                        key={f.id}
                        onClick={() => handleFont(f.id)}
                        style={{
                          fontFamily: f.family,
                          fontSize: 13,
                          padding: '0 12px',
                          height: 30,
                          borderRadius: 7,
                          border: activeFont === f.id ? '1px solid var(--accent)' : '1px solid var(--border-soft)',
                          background: activeFont === f.id ? 'var(--accent-soft)' : 'transparent',
                          color: activeFont === f.id ? 'var(--ink)' : 'var(--ink-3)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'border-color 0.13s, background 0.12s, color 0.12s',
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <div style={{
                    background: 'var(--bg-deep)',
                    border: '1px solid var(--border-soft)',
                    borderRadius: 10,
                    padding: '12px 14px',
                  }}>
                    <div style={{ font: '500 10px var(--font-mono)', letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 8 }}>
                      {EDITOR_FONTS.find(f => f.id === activeFont)?.fullName} · предпросмотр
                    </div>
                    <div style={{ fontFamily: EDITOR_FONTS.find(f => f.id === activeFont)?.family, fontSize: 17, lineHeight: 1.78, color: 'var(--ink-2)', transition: 'font-family 0.2s ease' }}>
                      Она вошла тихо, как входят люди, которые боятся спугнуть что-то хрупкое.{' '}
                      <em>Письмо было всё ещё на столе.</em>
                    </div>
                  </div>
                </div>
              </div>
            )}
```

- [ ] **Step 6: Verify**

```bash
npm run typecheck && npm run lint
```

Expected: no errors or warnings related to new code.

- [ ] **Step 7: Commit**

```bash
git add src/components/SettingsModal.tsx
git commit -m "feat(fonts): font picker in Settings → Interface tab"
```

---

## Task 6: Aa button + popover in StatusBar

**Files:**
- Modify: `src/components/StatusBar.tsx`

- [ ] **Step 1: Add import**

Find:
```typescript
import { useResponsive } from '../lib/useResponsive';
```

Replace with:
```typescript
import { useResponsive } from '../lib/useResponsive';
import { EDITOR_FONTS, getStoredEditorFont, applyEditorFont, EDITOR_FONT_EVENT, type EditorFontId } from '../lib/editorFont';
```

- [ ] **Step 2: Add font state, ref, and close-on-outside-click inside `StatusBar`**

Find:
```typescript
  const wrapperRef = useRef<HTMLDivElement>(null);
```

Replace with:
```typescript
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fontWrapperRef = useRef<HTMLDivElement>(null);
  const [fontOpen, setFontOpen] = useState(false);
  const [activeFont, setActiveFont] = useState<EditorFontId>(getStoredEditorFont);
```

- [ ] **Step 3: Add event listener and close-on-outside-click effects**

Find the existing outside-click effect for the sounds popover:
```typescript
  useEffect(() => {
    if (!popupOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setPopupOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [popupOpen]);
```

Add these two effects immediately after it:
```typescript
  useEffect(() => {
    if (!fontOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (fontWrapperRef.current && !fontWrapperRef.current.contains(e.target as Node)) {
        setFontOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [fontOpen]);

  useEffect(() => {
    const handler = (e: Event) => setActiveFont((e as CustomEvent<EditorFontId>).detail);
    window.addEventListener(EDITOR_FONT_EVENT, handler);
    return () => window.removeEventListener(EDITOR_FONT_EVENT, handler);
  }, []);
```

- [ ] **Step 4: Reorder right-side icon buttons and add Aa button**

Find the focus mode button block and the sounds button block (they appear consecutively after the spacer). The current order in the JSX is: `[focus btn] [sounds wrapper with popover]`.

Find:
```tsx
      {!isNarrow && onToggleFocusMode && (
        <button
          onClick={onToggleFocusMode}
          title={focusMode ? 'Выключить режим фокуса' : 'Режим фокуса'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            padding: 0,
            color: focusMode ? 'var(--accent)' : 'var(--ink-3)',
            borderRadius: 4,
            marginLeft: 4,
          }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
            <circle cx="12" cy="12" r="3"/>
            <path d="M3 12h2M19 12h2M12 3v2M12 19v2"/>
            <path d="M5.6 5.6l1.4 1.4M16.9 16.9l1.4 1.4M5.6 18.4l1.4-1.4M16.9 7.1l1.4-1.4"/>
          </svg>
        </button>
      )}
      {!isNarrow && (
        <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
```

Replace with:
```tsx
      {!isNarrow && onToggleFocusMode && (
        <button
          onClick={onToggleFocusMode}
          title={focusMode ? 'Выключить режим фокуса' : 'Режим фокуса'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            padding: 0,
            color: focusMode ? 'var(--accent)' : 'var(--ink-3)',
            borderRadius: 4,
            marginLeft: 4,
          }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
            <circle cx="12" cy="12" r="3"/>
            <path d="M3 12h2M19 12h2M12 3v2M12 19v2"/>
            <path d="M5.6 5.6l1.4 1.4M16.9 16.9l1.4 1.4M5.6 18.4l1.4-1.4M16.9 7.1l1.4-1.4"/>
          </svg>
        </button>
      )}
      {!isNarrow && (
        <div ref={fontWrapperRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <button
            onClick={() => setFontOpen(o => !o)}
            title="Шрифт редактора"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 22,
              height: 22,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: 0,
              color: fontOpen ? 'var(--accent)' : 'var(--ink-3)',
              borderRadius: 4,
              marginLeft: 4,
              font: '500 12px var(--font-ui)',
              letterSpacing: '-0.02em',
            }}
          >
            Aa
          </button>
          {fontOpen && (
            <div style={{
              position: 'absolute',
              bottom: 'calc(100% + 6px)',
              right: 0,
              width: 180,
              background: 'var(--surface)',
              border: '1px solid var(--border-soft)',
              borderRadius: 8,
              padding: 6,
              zIndex: 200,
              boxShadow: '0 4px 16px oklch(0 0 0 / 0.12)',
              animation: 'dropdown-in 0.12s cubic-bezier(0.22, 1, 0.36, 1) both',
            }}>
              {EDITOR_FONTS.map(f => (
                <button
                  key={f.id}
                  onClick={() => { applyEditorFont(f.id); setFontOpen(false); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontFamily: f.family,
                    fontSize: 13,
                    color: activeFont === f.id ? 'var(--ink)' : 'var(--ink-3)',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                >
                  {f.label}
                  {activeFont === f.id && (
                    <span style={{ color: 'var(--accent)', fontSize: 11, flexShrink: 0 }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {!isNarrow && (
        <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
```

- [ ] **Step 5: Verify**

```bash
npm run typecheck && npm run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/StatusBar.tsx
git commit -m "feat(fonts): Aa quick-switcher in StatusBar (focus → Aa → sounds order)"
```

---

## Task 7: Update docs

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/features/editor.md`

- [ ] **Step 1: Add editorFont.ts to CLAUDE.md Architecture section**

In `CLAUDE.md`, find the `### lib/` section and find the line:
```
- `src/lib/theme.ts` — `applyTheme`, `getStoredTheme`.
```

Add after it:
```
- `src/lib/editorFont.ts` — `EDITOR_FONTS`, `applyEditorFont`, `getStoredEditorFont`; CSS var `--font-editor`; dispatches `as-editor-font` CustomEvent для синхронизации SettingsModal ↔ StatusBar.
```

- [ ] **Step 2: Update docs/features/editor.md**

Open `docs/features/editor.md` and add a «Шрифт редактора» section describing:
- 5 доступных шрифта: Source Serif 4 (default), Lora, PT Serif, Spectral, IBM Plex Mono
- Хранится в `localStorage` (`as-editor-font`)
- CSS переменная `--font-editor` на `:root`
- Два места переключения: Настройки → Интерфейс (пиллы + предпросмотр), StatusBar (кнопка Aa)

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/features/editor.md
git commit -m "docs: document editor font picker in CLAUDE.md and features/editor.md"
```

---

## Self-Review

**Spec coverage check:**
- ✅ 5 fonts with Cyrillic — Task 1+2
- ✅ `editorFont.ts` mirrors theme.ts pattern — Task 2
- ✅ `--font-editor` CSS var on `:root` — Task 3
- ✅ `.sheet` and `.tiptap h1/h2/h3` wired to var — Task 3
- ✅ Boot initialization before render — Task 4
- ✅ SettingsModal: pills + live preview — Task 5
- ✅ StatusBar: Aa button, popover, focus→Aa→sounds order — Task 6
- ✅ Cross-component sync via CustomEvent — Tasks 5+6
- ✅ Docs updated — Task 7

**Type consistency:**
- `EditorFontId` defined in Task 2, used as-is in Tasks 5+6 ✅
- `EDITOR_FONT_EVENT` exported from Task 2, imported in Tasks 5+6 ✅
- `applyEditorFont` signature `(id: EditorFontId) => void` consistent across all tasks ✅
- `getStoredEditorFont` returns `EditorFontId`, used as `useState` initializer in Tasks 5+6 ✅
