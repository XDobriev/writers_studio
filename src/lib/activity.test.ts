import { describe, it, expect } from 'vitest';
import { computeActivityData, HEATMAP_WEEKS } from './activity';
import { toLocalISODate } from './dates';

describe('computeActivityData', () => {
  // Локальная полночь — toLocalISODate даёт одну и ту же дату в любой таймзоне.
  const today = new Date(2026, 5, 15);
  const todayStr = toLocalISODate(today);
  const yesterdayStr = toLocalISODate(new Date(2026, 5, 14));

  it('пустые снапшоты → нулевая активность и корректная размерность сетки', () => {
    const d = computeActivityData([], today);
    expect(d.cells).toHaveLength(HEATMAP_WEEKS * 7);
    expect(d.weeks).toHaveLength(HEATMAP_WEEKS);
    expect(d.todayWords).toBe(0);
    expect(d.streak).toBe(0);
    expect(d.maxDelta).toBe(1); // clamp до 1, чтобы не делить на ноль
    expect(d.monthLabels.length).toBeGreaterThan(0);
  });

  it('дельта дня = разница кумулятивных снапшотов, streak считает подряд активные дни', () => {
    const d = computeActivityData(
      [{ date: yesterdayStr, words: 100 }, { date: todayStr, words: 250 }],
      today,
    );
    expect(d.todayWords).toBe(150);
    expect(d.streak).toBe(2);
  });

  it('будущие дни не учитываются (delta = 0)', () => {
    const d = computeActivityData([{ date: todayStr, words: 500 }], today);
    expect(d.cells.filter(c => c.future).every(c => c.delta === 0)).toBe(true);
  });
});
