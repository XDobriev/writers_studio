import { describe, it, expect, vi } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: { from: vi.fn() },
}));

import { TYPE_LABELS, TYPE_COLORS, type TimelineEventType } from './timeline';

const ALL_TYPES: TimelineEventType[] = ['plot', 'character', 'world', 'other'];

describe('TYPE_LABELS', () => {
  it('содержит все четыре типа событий', () => {
    expect(Object.keys(TYPE_LABELS)).toHaveLength(4);
  });

  it('каждый тип имеет непустой label', () => {
    for (const type of ALL_TYPES) {
      expect(TYPE_LABELS[type].length).toBeGreaterThan(0);
    }
  });
});

describe('TYPE_COLORS', () => {
  it('содержит все четыре типа событий', () => {
    expect(Object.keys(TYPE_COLORS)).toHaveLength(4);
  });

  it('каждый тип имеет непустой цвет', () => {
    for (const type of ALL_TYPES) {
      expect(TYPE_COLORS[type].length).toBeGreaterThan(0);
    }
  });
});
