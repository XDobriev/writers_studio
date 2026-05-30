import { describe, it, expect } from 'vitest';
import { getCharacterColor, CHARACTER_COLORS } from './pov';

describe('getCharacterColor', () => {
  it('returns first color for index 0', () => {
    expect(getCharacterColor(0)).toBe(CHARACTER_COLORS[0]);
  });

  it('wraps around at palette length', () => {
    expect(getCharacterColor(5)).toBe(CHARACTER_COLORS[0]);
    expect(getCharacterColor(6)).toBe(CHARACTER_COLORS[1]);
  });

  it('works for large indices', () => {
    expect(getCharacterColor(100)).toBe(CHARACTER_COLORS[100 % CHARACTER_COLORS.length]);
  });
});
