---
target: Characters.tsx Сведения tab
total_score: 23
p0_count: 0
p1_count: 2
timestamp: 2026-05-29T09-05-48Z
slug: src-pages-characters-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Сохранение в тулбаре без привязки к полю |
| 2 | Match System / Real World | 3 | Метки понятны; «Разрыв» без контекста неочевиден |
| 3 | User Control and Freedom | 2 | Нет undo/redo для полей |
| 4 | Consistency and Standards | 2 | Hint есть у 3 из 7 полей |
| 5 | Error Prevention | 3 | Delete защищён; autosave работает |
| 6 | Recognition Rather Than Recall | 2 | Связь Interior→Exterior→Gap нигде не объяснена |
| 7 | Flexibility and Efficiency | 2 | Нет клавиатурных шорткатов |
| 8 | Aesthetic and Minimalist Design | 2 | 7 одинаковых карточек без иерархии |
| 9 | Error Recovery | 2 | Ошибка без привязки к полю |
| 10 | Help and Documentation | 2 | Hints только у 3 новых полей |
| **Total** | | **23/40** | **Acceptable** |

## Priority Issues

[P1] Bibisco-триада визуально разорвана — Gap стоит рядом с Предысторией. Fix: gridColumn 1/-1 для Gap.
[P1] 7 одинаковых карточек — нет иерархии. Fix: пространственная группировка через rowGap.
[P2] Inconsistent hints: 3 из 7 полей. Fix: добавить hints для Appearance, Personality, Backstory.
[P2] «Разрыв» — концептуальный термин без постоянного контекста.
