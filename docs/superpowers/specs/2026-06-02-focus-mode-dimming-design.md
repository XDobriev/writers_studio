# Focus Mode — Paragraph Dimming (§R6)

**Date:** 2026-06-02  
**Status:** Approved  
**Scope:** Только абзацное затемнение. Sentence mode и typewriter scrolling — вне скоупа.

---

## Проблема

Предыдущая попытка реализации провалилась из-за `opacity: 1 !important` в `design-system.css` — артефакт той же попытки, который блокировал любое opacity-based затемнение.

---

## Решение: Approach B — Opacity dimming

Убрать `opacity: 1 !important` (cleanup), установить `@tiptap/extension-focus` (добавляет `has-focus` на узел с курсором), добавить CSS-правила для режима фокуса.

---

## Файлы и изменения

### 1. `package.json`
```
npm install @tiptap/extension-focus
```

### 2. `src/components/RichEditor.tsx`
Добавить в импорты и массив extensions:
```ts
import Focus from '@tiptap/extension-focus';

// в StarterKit extensions:
Focus.configure({ className: 'has-focus', mode: 'shallowest' }),
```

`mode: 'shallowest'` — класс ставится на абзац (p, li, h1…), а не на вложенные spans.

### 3. `src/styles/design-system.css`
Из существующего reset-правила удалить одну строку:
```css
/* БЫЛО: */
.sheet .tiptap p, .sheet .tiptap li, ... {
  color: var(--paper-ink);
  opacity: 1 !important;   /* ← УДАЛИТЬ */
}

/* СТАЛО: */
.sheet .tiptap p, .sheet .tiptap li, ... {
  color: var(--paper-ink);
}
```

Добавить в конце блока редактора:
```css
/* Focus Mode — paragraph dimming */
.focus-mode .sheet .tiptap p,
.focus-mode .sheet .tiptap li,
.focus-mode .sheet .tiptap h1,
.focus-mode .sheet .tiptap h2,
.focus-mode .sheet .tiptap h3,
.focus-mode .sheet .tiptap blockquote {
  opacity: 0.25;
  transition: opacity 0.2s ease;
}

.focus-mode .sheet .tiptap .has-focus {
  opacity: 1;
}
```

### 4. `src/components/StatusBar.tsx`
Добавить два пропа:
```ts
focusMode?: boolean;
onToggleFocusMode?: () => void;
```

Кнопка-тоггл рядом с кнопкой наушников (только на desktop, скрыта на `isNarrow`):
```tsx
<button
  onClick={onToggleFocusMode}
  title="Режим фокуса"
  style={{
    /* та же стилизация, что у кнопки наушников */
    color: focusMode ? 'var(--accent)' : 'var(--ink-3)',
  }}
>
  {/* SVG иконка focus/crosshair 14x14 */}
</button>
```

### 5. `src/components/EditorHybrid.tsx`
```tsx
const [focusMode, setFocusMode] = useState(false);

// На <main>:
<main className={focusMode ? 'focus-mode' : ''} ...>

// В <StatusBar>:
<StatusBar
  ...
  focusMode={focusMode}
  onToggleFocusMode={() => setFocusMode(f => !f)}
/>
```

---

## Поведение

- **Toggle:** кнопка в StatusBar включает/выключает режим
- **Активный абзац:** полная яркость (opacity: 1) — управляется `has-focus` от TipTap extension
- **Остальные абзацы:** opacity: 0.25, плавный переход 0.2s
- **Потеря фокуса редактором:** `has-focus` снимается → весь текст приглушается (MVP; улучшим позже при необходимости)
- **Мобайл:** кнопка скрыта (как кнопка наушников на `isNarrow`)
- **Состояние:** не персистится (сбрасывается при перезагрузке страницы) — intentional для MVP

---

## Что НЕ входит в скоуп

- Sentence-level dimming
- Typewriter scrolling
- Персистентность состояния (localStorage)
- Горячая клавиша для toggle

---

## Проверка после реализации

1. Focus mode включается кнопкой в StatusBar
2. Абзац с курсором — полная яркость, остальные — приглушены
3. Переключение между абзацами — плавный переход
4. При выключении — все абзацы возвращаются к нормальному виду
5. Нет регрессий: обычный редактор без focus mode работает как раньше
6. Popup'ы (ambient sounds, bubble menu) не сломаны z-index'ом
