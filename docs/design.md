---
name: Авторская студия
description: An immersive writing environment for serious authors — from first draft to finished manuscript.
colors:
  sienna-ink: "oklch(0.63 0.16 30)"
  lamplight-amber: "oklch(0.78 0.10 90)"
  ink: "oklch(0.95 0.008 80)"
  ink-secondary: "oklch(0.78 0.012 80)"
  ink-muted: "oklch(0.65 0.012 70)"
  ink-ghost: "oklch(0.56 0.012 60)"
  oak-void: "oklch(0.165 0.012 50)"
  oak-dark: "oklch(0.205 0.014 50)"
  oak-surface: "oklch(0.245 0.014 50)"
  oak-surface-2: "oklch(0.295 0.012 50)"
  oak-surface-3: "oklch(0.345 0.012 50)"
  oak-border-soft: "oklch(0.28 0.010 50)"
  oak-border: "oklch(0.34 0.012 50)"
  writing-cream: "oklch(0.965 0.014 85)"
  manuscript-ink: "oklch(0.22 0.020 60)"
  manuscript-ink-2: "oklch(0.42 0.020 60)"
  semantic-ok: "oklch(0.72 0.14 145)"
  semantic-warn: "oklch(0.80 0.14 80)"
  semantic-danger: "oklch(0.65 0.18 25)"
  semantic-info: "oklch(0.72 0.10 230)"
typography:
  display:
    fontFamily: "'Source Serif 4', Georgia, serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.012em"
  headline:
    fontFamily: "'Source Serif 4', Georgia, serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "'Source Serif 4', Georgia, serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "'Source Serif 4', Georgia, serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.78
    letterSpacing: "0.005em"
  body-ui:
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'IBM Plex Mono', ui-monospace, monospace"
    fontSize: "10.5px"
    fontWeight: 500
    letterSpacing: "0.12em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "36px"
components:
  button-primary:
    backgroundColor: "{colors.sienna-ink}"
    textColor: "oklch(0.98 0 0)"
    rounded: "{rounded.md}"
    height: "30px"
    padding: "0 12px"
  button-primary-hover:
    backgroundColor: "oklch(0.68 0.16 30)"
    textColor: "oklch(0.98 0 0)"
    rounded: "{rounded.md}"
    height: "30px"
  button-default:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "30px"
    padding: "0 12px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.md}"
    height: "30px"
  input:
    backgroundColor: "{colors.oak-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "38px"
    padding: "0 12px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.pill}"
    height: "22px"
    padding: "0 8px"
  chip-accent:
    backgroundColor: "oklch(0.63 0.16 30 / 0.16)"
    textColor: "{colors.sienna-ink}"
    rounded: "{rounded.pill}"
    height: "22px"
  toolbar-button:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.sm}"
    height: "28px"
---

# Design System: Авторская студия

## 1. Overview

**Creative North Star: "The Author's Atelier"**

A craftsman's studio at the edge of midnight — warm oak shelves, the smell of paper, a single lamp cutting the dark. The interface is the room: controlled, quiet, designed around one purpose. The manuscript is the work on the desk. Everything else earns its presence by serving it.

This is not a productivity suite. It is not a content platform, a wiki engine, or a document editor. It is a purpose-built writing environment where the act of authorship is treated as a serious craft. The chrome is subordinate, restrained, nearly invisible. The paper surface is generous, readable, luminous.

The palette lives in two worlds simultaneously: a warm-dark oak shell where tools wait in shadow, and a cream manuscript surface that glows in contrast. These two zones never bleed into each other. The shell stays dark; the page stays bright. Tension between them creates the sense of a focused workspace — a room built for writing.

**Key Characteristics:**
- Warm dark shell (oak-stained, amber-tinted) framing a luminous cream manuscript surface
- Three typefaces in strict jurisdictions: IBM Plex Sans for chrome, Source Serif 4 for the page, IBM Plex Mono for counters and metadata
- One accent colour (Sienna Ink) used with discipline; a second (Lamplight Amber) for progress and warmth signals
- Flat tonal elevation: depth through luminance steps, not box shadows
- Restrained component vocabulary: everything quiet at rest, responsive on interaction

## 2. Colors: The Atelier Palette

Two worlds, no mixing: dark oak for the studio, warm cream for the manuscript.

### Primary

- **Sienna Ink** (`oklch(0.63 0.16 30)` ≈ deep terracotta-burgundy): The single interactive accent. Active chapter numbers in the sidebar, focus rings, primary buttons, selected toolbar states, the active tab underline. Never decorative — Sienna Ink always means "this is the thing that matters right now."

- **Lamplight Amber** (`oklch(0.78 0.10 90)` ≈ warm amber-gold): Progress indicators, in-progress status dots, the avatar gradient endpoint. Softer and less demanding than Sienna Ink — it signals warmth and ongoing activity rather than a selected state.

### Neutral: Shell Surfaces

Five tonal steps form the depth system of the dark shell. They share hue 50 (warm amber-brown), with chroma suppressed to 0.010–0.014.

- **Oak Void** (`oklch(0.165 0.012 50)`): The deepest surface. Sidebar background, status bar, section footers. The room in shadow.
- **Oak Dark** (`oklch(0.205 0.014 50)`): Main application background. The floor of the studio.
- **Oak Surface** (`oklch(0.245 0.014 50)`): Elevated panels, input backgrounds, sidebar hover states.
- **Oak Surface-2** (`oklch(0.295 0.012 50)`): Deeper hover backgrounds, active item backgrounds.
- **Oak Surface-3** (`oklch(0.345 0.012 50)`): Highest tonal step. Strong hover, focus-area fills.

### Neutral: Ink

Four ink steps for text hierarchy, all with a warm amber tint (hue 70–80) rather than cold grey.

- **Ink** (`oklch(0.95 0.008 80)`): Primary text in the shell. Headlines, body copy, labels.
- **Ink Secondary** (`oklch(0.78 0.012 80)`): Supporting text, inactive controls, toolbar buttons at rest.
- **Ink Muted** (`oklch(0.65 0.012 70)`): Section headers (uppercase mono), placeholder prompts.
- **Ink Ghost** (`oklch(0.56 0.012 60)`): Metadata, word counts, timestamps. Present but undemanding, yet still WCAG AA on the oak shells.

### Neutral: Paper

The manuscript surface and its typography. Kept separate from shell neutrals — they must never mix.

- **Writing Cream** (`oklch(0.965 0.014 85)`): The editor page background. Warm off-white, not pure white. The paper.
- **Manuscript Ink** (`oklch(0.22 0.020 60)`): Primary text on the page. Dark warm charcoal — rich, not black.
- **Manuscript Ink-2** (`oklch(0.42 0.020 60)`): Chapter number prefixes, scene-break punctuation, placeholder text on the page.

### Semantic

Used exclusively in system feedback. Never repurposed as brand or decorative colour.

- **Ok** (`oklch(0.72 0.14 145)`): Saved, synced, published.
- **Warn** (`oklch(0.80 0.14 80)`): Caution states, approaching limits.
- **Danger** (`oklch(0.65 0.18 25)`): Errors, spell-check underlines, destructive actions.
- **Info** (`oklch(0.72 0.10 230)`): Informational callouts, grammar-check underlines.

**Deep semantic surfaces.** Where a semantic hue needs a filled surface with legible text (not just an accent line), use the deep-tint tokens rather than transparency of the base:

- **Error toast** — `--danger-bg` (`oklch(0.28 0.06 25)`) fill, `--danger-border` (`oklch(0.45 0.12 25)`), `--danger-ink` (`oklch(0.92 0.04 25)`) text.
- **Diff text on paper** — `--diff-ins-ink` (`oklch(0.40 0.18 145)`) for insertions, `--diff-del-ink` (`oklch(0.50 0.20 25)`) for deletions; darker than the base Ok/Danger hues so the text stays readable on the light manuscript surface.

### Named Rules

**The Rarity Doctrine.** Sienna Ink occupies ≤10% of any given screen. Active chapter number, focus ring, one button, one tab underline. Its scarcity is the point. The moment it appears everywhere, it appears nowhere.

**The Two-World Rule.** Shell neutrals (Oak family) and manuscript neutrals (Writing Cream, Manuscript Ink) never mix. Do not use `oak-surface` as a background in the editor; do not use `writing-cream` as a panel background in the chrome.

**The Warm Neutral Doctrine.** Every neutral in this system — dark or light — carries a fractional chroma toward hue 50–85 (amber-warm). Pure achromatic greys (`#888`, `oklch(0.5 0 0)`) are forbidden. The warmth is what makes the studio feel like a room, not a UI kit.

## 3. Typography: Three Jurisdictions

**Display / Body Font:** Source Serif 4 (with Georgia, serif)
**UI Font:** IBM Plex Sans (with system-ui, sans-serif)
**Label / Counter Font:** IBM Plex Mono (with ui-monospace, monospace)

**Character:** Each typeface holds its territory absolutely. Source Serif 4 belongs to the manuscript — chapter titles, body prose, headings within the document. IBM Plex Sans handles the studio chrome — toolbars, sidebar, panels, navigation. IBM Plex Mono carries all numeric and categorical metadata — chapter numbers, word counts, timestamps, uppercase labels. The pairing signals: here is the work (serif), here is the tool (sans), here are the measurements (mono).

### Hierarchy

- **Display** (Source Serif 4, 600 weight, 32px, line-height 1.15, tracking −0.012em): Chapter titles on the manuscript page. The most authoritative typographic moment in the product. Used once per chapter view.
- **Headline** (Source Serif 4, 600 weight, 22px, line-height 1.3, tracking −0.01em): H2 headings within the document body. Second hierarchy level inside the manuscript.
- **Title** (Source Serif 4, 600 weight, 17px, line-height 1.4): H3 within the document; in-product headings where a serif presence is appropriate (export dialogs, settings).
- **Body** (Source Serif 4, 400 weight, 17px, line-height 1.78, tracking +0.005em): All prose on the paper surface. The most-read text in the product. Max line length 65–72ch (enforced by the 720px sheet container). Generous leading (1.78) mirrors the rhythm of well-set book typography.
- **Body UI** (IBM Plex Sans, 400 weight, 13px, line-height 1.5): All text in the application shell — sidebar chapter titles, panel copy, button labels, navigation. Dense but readable.
- **Label** (IBM Plex Mono, 500 weight, 10.5px, tracking +0.12em, uppercase): Section headers, category prefixes, metadata labels. The mono anchors these as systematic, not editorial.

### Named Rules

**The Serif Jurisdiction Rule.** Source Serif 4 lives on the paper surface and nowhere else. It is forbidden in toolbar buttons, sidebar section headers, status bars, or panel labels. The moment a serif appears in chrome, the boundary between studio and manuscript dissolves.

**The Mono Counter Rule.** Every number that quantifies rather than narrates belongs in IBM Plex Mono: word counts, chapter numbers, timestamps, progress percentages. This is not decoration — it is a typographic signal that the number is a measurement, not prose.

## 4. Elevation

This system is flat by default. Depth is expressed through background luminance (the five Oak surface steps), not box shadows. A component that sits at `oak-surface` against an `oak-dark` background reads as elevated without a single drop shadow.

Box shadows appear only when an element has physically left its containing surface and floats above it — menus, tooltips, the floating bubble format toolbar. There are two shadow moments in the current system:

### Shadow Vocabulary

- **Floating** (`0 12px 32px oklch(0 0 0 / 0.5), 0 1px 0 oklch(1 0 0 / 0.07) inset`): The bubble menu — the floating format toolbar that appears over selected text. A deep ambient drop shadow plus a 1px inner highlight that lifts the surface visually. This is the only heavy shadow in the system.

### Named Rules

**The Shadowless Default Rule.** At rest, all surfaces are differentiated by background luminance, not by elevation. Borders (`oak-border-soft`, 1px) mark edges; tonal steps mark hierarchy. A box shadow is a signal that an element has left its context. Use it only for genuinely floating elements.

## 5. Components

### Buttons

The interface does not demand attention. Buttons are quiet instruments.

- **Shape:** Gently rounded edges (8px, `--r-2`). Not sharp, not pill-shaped. Controlled.
- **Primary:** Deepened Sienna Ink fill (`--accent-deep` = `oklch(0.46 0.16 30)`), near-white text (`oklch(0.98 0 0)`), 30px height, 12px horizontal padding. The fill is darker than the `--accent` brand tone on purpose — it keeps white text at WCAG AA (light Sienna Ink would drop below the 4.5:1 body threshold). Used for the single most important action on a given surface: Save, Publish, Confirm.
- **Hover:** Primary lightens by one step to `--accent-deep-hover` (`oklch(0.52 0.16 30)`), 120ms transition. No transform, no scale, no shadow.
- **Default (border):** Transparent background, `oak-border` (1px) stroke, `ink` text. The workhorse button for secondary actions: Export, Share, Cancel.
- **Ghost:** Transparent background, no border, `ink-secondary` text. For toolbar-area actions where even a border would be too loud.
- **Disabled:** 50% opacity. No cursor change to pointer. Never misleadingly enabled.
- **Focus ring:** 2px `sienna-ink` outline, 2px offset. Visible, on-brand, never obtrusive.

### Chips

Chips are for categorical state display, not navigation.

- **Default:** Pill shape (`999px`), 22px height, `oak-border` stroke, no background fill, `ink-secondary` text, 11px IBM Plex Sans.
- **Accent:** Sienna Ink tinted fill (`oklch(0.63 0.16 30 / 0.16)`), Sienna Ink stroke and text. Used for "active", "selected", or primary-category labels.
- **Ok:** Green tinted fill, `semantic-ok` stroke and text. Used for "Completed", "Published" status.

### Inputs and Fields

Form inputs are functional, undecorated, and immediately legible.

- **Style:** `oak-surface` background, `oak-border` stroke (1px), 8px radius, 38px height, 13.5px IBM Plex Sans body text. Full width within its container.
- **Focus:** Border shifts to `sienna-ink`. No shadow, no glow. Clean and direct.
- **Error:** Border shifts to `semantic-danger`. No fill change.
- **Labels:** IBM Plex Mono, 10.5px, uppercase, `ink-muted` colour, 6px below the label before the input. Non-negotiable — every input has a label.
- **Placeholder:** `ink-ghost` colour. Descriptive, not instructional ("Chapter title" not "Enter chapter title here").

### Navigation: Sidebar

The sidebar uses a two-tone system: `oak-void` background (deepest), items that reveal `oak-surface` on hover.

- **Item layout:** CSS grid `22px / 1fr / auto` — chapter number (mono), title (sans), word count (mono).
- **Chapter numbers:** IBM Plex Mono, 11px, `ink-ghost` at rest, `sienna-ink` when active. The number becomes an accent the moment you're in that chapter.
- **Active state:** `oak-surface` background fill; no left-border stripe. The background change is sufficient.
- **Section headers:** IBM Plex Mono, 10.5px, uppercase, `ink-muted`, tracking +0.12em.

### Navigation: Toolbar

The toolbar is 44px tall, `oak-dark` background — the same as the main content area, so it visually merges.

- **Toolbar buttons:** 28px height, 5px horizontal padding, 4px radius. Transparent at rest; `oak-surface` on hover; `oak-surface-2` when active/on. `ink-secondary` text at rest; `ink` on hover.
- **Separator:** 1px vertical rule, `oak-border-soft`, 18px tall, 2px margin each side.
- **Min touch target (mobile):** 44×44px, enforced via `@media (max-width: 768px)`.

### Signature Component: The Manuscript Sheet

The paper surface is the most important component in the product.

- **Container:** `writing-cream` background, 720px max-width, centered, 4px top radius, 0px bottom radius (the page flows off the bottom).
- **Padding:** 56px top, 72px sides, 80px bottom — generous, like a well-margined book.
- **Typography:** Source Serif 4, 17px, line-height 1.78, `manuscript-ink` colour. First-line indent (1.4em) on all paragraphs except those following headings.
- **Drop zone:** `oak-bg` wrapper with 36px top padding and 48px side padding creates the illusion of a page resting on a desk.
- **Bubble menu:** Appears 8px above selected text. Floating dark pill, `0 12px 32px oklch(0 0 0 / 0.5)` shadow, 11px entry animation (`translateY(5px) → 0, scale(0.96) → 1`, 130ms cubic-bezier(.22,.68,0,1.2)).

### Margin Note Cards

Sidebar annotations that reference highlighted passages.

- **Container:** `oak-surface` background, `oak-border-soft` stroke, 8px radius, 10px/12px internal padding.
- **Left accent strip:** 2px wide, 4px radius, positioned inside the left border — Lamplight Amber for ideas, blue (`semantic-info`) for questions, green (`semantic-ok`) for todos, Sienna Ink for important. This is the one permitted use of a left-side border element, because the strip is part of a categorical system, not a decorative pattern.
- **Label:** IBM Plex Mono, 9.5px, uppercase, `ink-muted`.
- **Body text:** IBM Plex Sans, 12.5px, `ink`, line-height 1.55.
- **Quote reference:** Italic, `ink-muted`, 11.5px, `oak-border` left-stroke 1.5px — the excerpt from the manuscript.

## 6. Do's and Don'ts

### Do:

- **Do** keep Sienna Ink (`oklch(0.63 0.16 30)`) as the single interactive accent. One primary button, one active number, one focus ring per screen — not three.
- **Do** express depth through background luminance: `oak-void` → `oak-dark` → `oak-surface` → `oak-surface-2` → `oak-surface-3`. Step through these levels in order; never skip two levels.
- **Do** keep Source Serif 4 exclusively on the manuscript surface. The moment it appears in sidebar, toolbar, or panel, the author-tool boundary breaks.
- **Do** use IBM Plex Mono for all numeric metadata: chapter counts, word counts, timestamps, progress percentages, section labels in uppercase.
- **Do** tint every neutral toward amber (hue 50–85). Chroma 0.008–0.014 is enough to make the dark feel warm, not cold.
- **Do** enforce first-line indent (1.4em) on body prose paragraphs, reset to zero after headings and scene breaks.
- **Do** use the 8-step Oak surface system for modal overlays: `oak-void` at 60–70% opacity as the scrim; the dialog itself at `oak-surface-2`.
- **Do** use WCAG AA contrast minimums — 4.5:1 for body text, 3:1 for large text and UI components — in both dark and light themes independently.
- **Do** verify `prefers-reduced-motion`: disable the bubble-menu animation; preserve colour transitions (they carry state information, not decoration).

### Don't:

- **Don't** use Notion's block-based page metaphor. There are no `/` commands, no drag-to-restructure blocks, no database tables. The manuscript is a flowing document, not a knowledge base.
- **Don't** make this feel like Google Docs or Word. No ribbon toolbar, no document-property sidebars, no track-changes UI that turns the page into a red-and-green mess. The paper is clean. Always.
- **Don't** build Scrivener-style cork boards, index-card grids, or "project binder" tree navigators. The chapter list in the sidebar is enough structure. Resist the urge to add visual planning surfaces that compete with the editor.
- **Don't** add blog-platform affordances (like Medium's read-time, Substack's subscriber counts, or any sense that the document is public-first). Every writing surface is private by default; sharing is an explicit export action.
- **Don't** use pure achromatic colours (`#888`, `oklch(0.5 0 0)`, `gray-500`). Every neutral must carry a fractional amber tint. Cold greys break the warmth of the atelier.
- **Don't** use `border-left` as a coloured accent stripe on cards or list items. The only permitted left-stripe is the margin note category indicator, which is a categorical encoding, not decoration.
- **Don't** use gradient text (`background-clip: text` with a gradient). For emphasis in the editor: weight or size. In the shell: colour change to Sienna Ink.
- **Don't** mix paper and shell neutrals. Writing Cream (`oklch(0.965 0.014 85)`) is reserved for the manuscript surface. It is never a panel background, modal fill, or sidebar section.
- **Don't** add a SaaS metric dashboard. No hero numbers, no progress rings, no "words written today" widgets competing with the writing surface. Status bar at the bottom is enough.
- **Don't** add decorative shadows or glassmorphism to shell panels. The Floating shadow exists for one element: the bubble menu. Everything else is flat.

## 7. Scrollbars

Every scrollable container in the product uses one of three explicit scrollbar patterns. Never leave scrollbars at browser default.

### Three Patterns

- **Thin panel** (`.sb-body`, `.rp-body` and similar overflow panels): `scrollbar-width: thin; scrollbar-color: var(--surface-3) transparent`. A minimal thumb, no visible rail. The thumb appears only when the user scrolls.
- **Hidden** (`.tb` toolbar): `scrollbar-width: none` + `::-webkit-scrollbar { display: none }`. The container is overflow-scrollable but the scrollbar is completely invisible — toolbars communicate overflow with fade gradients or truncation, not a scrollbar.
- **Sheet** (`.sheet-wrap`): Custom webkit — 5px width, pill thumb (`border-radius: 999px`), `var(--surface-3)` fill at rest, `var(--border-strong)` on hover, transparent track. The manuscript scroll container is the most prominent in the product, so its scrollbar gets a deliberate hover state.
- **Global fallback** (`.as ::-webkit-scrollbar`): 10px width, `var(--border)` thumb, transparent track — for any `.as` child container not explicitly covered above.

### Named Rules

**The Invisible Track Rule.** The scrollbar rail (track) is always `transparent`. Never give it a background fill. Only the thumb is visible.

**The Pill Thumb Rule.** All webkit scrollbar thumbs use `border-radius: 999px`. No rectangular thumbs.

**The Warm Thumb Rule.** Thumb color comes from the surface/border token family — `var(--surface-3)` or `var(--border)`. Never use a pure grey or achromatic value.

## 8. Motion & Transitions

The studio is calm at rest. Motion communicates state change, not delight. Every transition is short and purposeful.

### Timing Vocabulary

| Token | Duration | Use |
|---|---|---|
| `--dur-instant` | `0.1s` | Immediate state toggle: button active background, pressed state |
| `--dur-hover` | `0.12s` | Hover response: toolbar button color, color swatch scale, dropdown entry |
| `--dur-spring` | `0.13s` | Entry spring (see easing below): bubble menu, modal, dropdown appear |
| `--dur-fast` | `0.15s` | Fade-in, link and chip color transitions, sidebar book title hover |
| `--dur-exit` | `0.09s` | Any exit animation (~70% of enter duration) |
| `--dur-panel` | `0.22s` | Sidebar, right panel slide entry |
| `--dur-page` | `0.2s` | Page transitions, editor mode crossfade, scrollbar thumb hover |

### Easing Curves

| Token | Value | Use |
|---|---|---|
| `--ease-spring` | `cubic-bezier(0.22, 0.68, 0, 1.2)` | Entry-only: elements that physically appear (bubble, modal, toast). Never on persistent UI. |
| `--ease-out-quint` | `cubic-bezier(0.22, 1, 0.36, 1)` | Standard deceleration: dropdowns, panel slides, page transitions |
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Decisive, confident: mode switching, hero moments |

### Keyframes

**Implemented:**
- **`bubble-in`**: `opacity 0→1, translateY(5px)→0, scale(0.96)→1` — bubble menu entry.
- **`toast-in`**: `opacity 0→1, translateY(8px)→0, scale(0.96)→1` — toast notification entry.
- **`slide-down`**: `translateY(-100%)→0` — panel slide in from above.
- **`spin`**: `rotate 360deg` linear infinite — page loading spinner (0.75s).
- **`blink`**: step-based opacity toggle — text cursor blink.

**Planned (roadmap §39–45):**
- **`dropdown-in`**: `opacity 0→1, translateY(-6px)→0, scale(0.98)→1` — context menus, user dropdown, status menu, sound popup. Duration: `--dur-hover`, easing: `--ease-out-quint`.
- **`modal-in`**: `opacity 0→1, scale(0.97)→1` — VersionModal and any full-screen overlays. Duration: `--dur-spring`, easing: `--ease-spring`.
- **`fade-in`**: `opacity 0→1` — editor mode panel crossfade, scrim, page transitions. Duration: `--dur-fast`.
- **`toast-out`**: `opacity 1→0, translateY(-4px), scale(0.97)→1` — toast exit before unmount. Duration: `--dur-exit`.
- **`panel-enter-right`**: `translateX(100%)→0` — mobile right panel slide-in. Duration: `--dur-panel`, easing: `--ease-out-quint`.
- **`scale-flash`**: `scale(1)→scale(1.08)→scale(1)` — copy-confirmation micro-interaction. Duration: `0.2s ease-out`.
- **`shimmer`**: `translateX(-100%)→translateX(200%)` — skeleton loading highlight sweep. Duration: `1.4s ease-in-out infinite`. Applied via `.skeleton::after` pseudo-element.

### Named Rules

**The Reduced Motion Rule.** Wrap all `@keyframes` usage in `@media (not prefers-reduced-motion)` or use `prefers-reduced-motion: reduce` to disable transform/opacity animations. Color transitions (hover backgrounds, focus rings) are exempt — they carry state information, not decoration.

**The Layout Property Rule.** Never animate `width`, `height`, `padding`, or `margin`. Only `color`, `background`, `opacity`, `transform`, and `border-color` are permitted in transitions.

**The No-Bounce Default Rule.** The spring easing `--ease-spring` is used only for entry animations. Hover states, color changes, and persistent UI use `ease-out` curves — never a bouncy curve on an element that is already visible.

**The Exit Speed Rule.** Exit animations are always ~70% of the corresponding enter duration. User has already committed to the action and is waiting for what comes next — don't make them watch the departure.

**The Hero Motion Rule.** The editor mode transition (`studio → page`) is the one signature animation in the product. The crossfade of panels as the manuscript expands to full screen should feel like the studio going quiet — calm, deliberate, with the manuscript taking over. This is not a UI transition; it is the product's core promise made visible.

## 9. Light Theme

The light theme activates via `[data-theme="light"]` on `<html>`. Only surface (`--bg-*`, `--surface-*`, `--border-*`) and ink variables are overridden. Accent colors, paper/manuscript variables, and semantic colors are identical in both themes.

### Surface Hierarchy (Light)

Light surfaces use a parchment-linen family (hue 55–70), with luminance inverted relative to dark mode:

- `--bg: oklch(0.91 0.010 68)` — main area, medium parchment. The "desk." Noticeably darker than the paper surface to ensure the sheet is visible.
- `--bg-deep: oklch(0.86 0.014 65)` — sidebar, status bar, right panel. Deeper parchment.
- `--surface` → `--surface-3`: steps from 0.95 (hover/elevated) down to 0.83, all carrying chroma 0.010–0.012 toward hue 55–65.

### Ink (Light)

Dark warm charcoal, not pure black. All ink values carry a warm brown tint (hue 60):

- `--ink: oklch(0.18 0.022 60)` — primary text.
- `--ink-2 … --ink-4`: step up in lightness toward `oklch(0.56 0.012 60)` (ghost/metadata).

### Named Rules

**The Accent Stability Rule.** `--accent` (Sienna Ink) and `--accent-2` (Lamplight Amber) do not change between themes. An active chapter number, a primary button, a focus ring — always the same color.

**The Paper Stability Rule.** `--paper`, `--paper-ink`, `--paper-ink-2`, and all paper-rule/edge variables are theme-invariant. The manuscript surface looks identical in both modes — it is a light cream surface always, not a reactive surface.

**The Warm Neutral Doctrine (Light).** The same rule applies in light mode: every neutral carries fractional chroma toward hue 50–85. Pure white (`oklch(1 0 0)`) and pure achromatic greys are forbidden. The parchment warmth must be perceptible even at low chroma.
