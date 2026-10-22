import { describe, it, expect } from 'vitest';
import { connectionGeometry, pinLabel, riverBowSign } from './mapGeometry';

describe('connectionGeometry', () => {
  it('дорога — прямая линия, середина посередине', () => {
    const g = connectionGeometry({ id: 'a', style: 'road' }, 0, 0, 100, 0);
    expect(g.d).toBe('M0,0 L100,0');
    expect(g.midX).toBe(50);
    expect(g.midY).toBe(0);
  });

  it('река — квадратичная кривая с изгибом, стабильным по id', () => {
    const g = connectionGeometry({ id: 'river-1', style: 'river' }, 0, 0, 100, 0);
    const bow = Math.min(100 * 0.22, 60) * riverBowSign('river-1');
    expect(g.d).toBe(`M0,0 Q50,${bow} 100,0`);
    // точка кривой при t=0.5 — половина отклонения контрольной точки
    expect(g.midY).toBeCloseTo(bow / 2);
    expect(connectionGeometry({ id: 'river-1', style: 'river' }, 0, 0, 100, 0).d).toBe(g.d);
  });

  it('подпись пина обрезается так же, как на холсте', () => {
    expect(pinLabel('Короткое')).toBe('Короткое');
    expect(pinLabel('Очень длинное название города')).toBe('Очень длинное н…');
  });
});
