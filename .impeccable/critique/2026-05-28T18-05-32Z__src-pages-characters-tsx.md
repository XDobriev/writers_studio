---
timestamp: 2026-05-28T18-05-32Z
slug: src-pages-characters-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Save indicator есть; нет визуального сигнала что grid отфильтрован |
| 2 | Match System / Real World | 4 | «Картотека» = сетка карточек — метафора реализована точно |
| 3 | User Control and Freedom | 3 | «← Сетка» работает; Escape из детального вида не возвращает в grid |
| 4 | Consistency and Standards | 3 | Метка роли в карточке не следует label-стилю системы |
| 5 | Error Prevention | 3 | Удаление с подтверждением; кнопка «Карточка» disabled без персонажа |
| 6 | Recognition Rather Than Recall | 3 | Всё подписано, tooltip на кнопках есть, но не видим без ховера |
| 7 | Flexibility and Efficiency | 2 | Нет keyboard-шортката для переключения вида |
| 8 | Aesthetic and Minimalist Design | 2 | Правая панель «Выберите персонажа» в grid-режиме — мёртвое пространство |
| 9 | Error Recovery | 2 | Общий error-экран есть; grid-специфичных recovery нет |
| 10 | Help and Documentation | 1 | Только title-атрибуты на ховере |
| **Итого** | | **26/40** | **Acceptable** |

## Anti-Patterns Verdict

**LLM assessment**: Не выглядит как «AI made that». Цветовое кодирование по роли через градиенты — осмысленное решение. Тёплая тёмная палитра выдержана. Единственное нарушение: синий портретный gradient (`oklch(0.32 0.09 260)`) для secondary — это semantic info-цвет, нарушающий правило «никогда не использовать semantic colors декоративно».

**Deterministic scan**: CLI-детектор недоступен (bundled detector not found). Ручной анализ: onMouseEnter/Leave вместо CSS :hover (3 случая); нет aria-label на кнопках-карточках.

## Overall Impression

Картотека заработала — метафора реализована. Три P2: правая панель в grid-режиме, синий gradient secondary, несоответствие label-стиля. Ни одной блокирующей проблемы.

## What's Working

1. Цветовое кодирование по роли работает мгновенно — 110px portrait-область даёт достаточно цветовой массы.
2. Навигация сетка ↔ карточка без потери контекста — «← Сетка» + переключатель, URL обновляется.
3. AddCard с пунктирной границей органично вписывается в сетку.

## Priority Issues

**[P2] Правая панель «СВЯЗИ» в grid-режиме — мёртвое пространство**
Занимает ~200px, уменьшая ширину сетки. Fix: скрыть `aside.rp` когда `showGrid === true`.

**[P2] Синий портретный gradient для secondary нарушает палитру**
`oklch(0.32 0.09 260)` — semantic info-цвет. Fix: заменить на warm oak: `linear-gradient(160deg, oklch(0.34 0.035 60), oklch(0.22 0.02 55))`.

**[P2] Метка роли в карточке не соответствует label-стилю системы**
400 weight, 10px, 0.08em вместо 500 weight, 10.5px, 0.12em, uppercase. Fix: привести к стандарту.

**[P3] AddCard minHeight 148 vs фактическая высота CharacterCard ~162px**
Fix: убрать minHeight, добавить alignSelf: 'stretch'.

## Persona Red Flags

**Писатель-профи (40+ персонажей)**: Нет группировки по ролям в самой сетке (только через фильтр сайдбара). Нет полнотекстового поиска по полям.

**Power User**: Нет keyboard-шортката для переключения grid/detail.

## Minor Observations

- onMouseEnter/Leave вместо CSS :hover — риск залипания.
- Кнопки grid/char в tb-grp без aria-label.
- AddCard использует useState(hovered) — можно CSS.
- ROLE_COLOR.minor = var(--ink-4) — нужно проверить контраст метки «Эпизодический».
