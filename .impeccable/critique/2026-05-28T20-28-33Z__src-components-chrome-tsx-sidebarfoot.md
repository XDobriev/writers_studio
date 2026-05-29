---
target: SidebarFoot dropdown
total_score: 28
p0_count: 0
p1_count: 3
timestamp: 2026-05-28T20-28-33Z
slug: src-components-chrome-tsx-sidebarfoot
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Chevron корректен, нет feedback при async signOut |
| 2 | Match System / Real World | 4 | Настройки + log-out icon — узнаваемо |
| 3 | User Control and Freedom | 3 | Click-outside есть, Escape отсутствует |
| 4 | Consistency and Standards | 3 | Стиль дропдауна совпадает с status-menu; триггер без hover |
| 5 | Error Prevention | 3 | Danger color у Выйти — хорошая сигнализация |
| 6 | Recognition Rather Than Recall | 3 | Иконка + лейбл; chevron 12px ink-4 слишком тихий |
| 7 | Flexibility and Efficiency | 2 | Нет Escape, нет автофокуса, нет keyboard nav |
| 8 | Aesthetic and Minimalist Design | 3 | Два пункта, ноль декора; тень чуть сильнее нормы |
| 9 | Error Recovery | 2 | Нет loading/error state при async signOut |
| 10 | Help and Documentation | 2 | Нет aria-label на триггере |
| **Total** | | **28/40** | **Good** |

## Priority Issues

**[P1] Нет hover-состояний на пунктах дропдауна** — Fix: CSS .sb-dropdown-item:hover { background: var(--surface-2) }
**[P1] Триггер .sb-foot без hover** — Fix: .sb-foot:hover { background: var(--surface) }
**[P1] Нет feedback при async signOut** — Fix: isSigningOut state + opacity/pointer-events
**[P2] Escape не закрывает дропдаун** — Fix: keydown listener в useEffect
**[P2] Нет entry-анимации** — Fix: animation: bubble-in 0.13s cubic-bezier(.22,.68,0,1.2)

## Strengths

1. Два пункта и ничего лишнего — дисциплина.
2. var(--danger) на Выйти — правильная иерархия риска.
3. Шеврон как индикатор состояния — 0.12s rotate(180deg).

## Minor Observations

- role="button" на div — нативный button надёжнее
- aria-label отсутствует
- Shadow opacity 0.32 vs 0.18 в status-menu
