import { describe, it, expect } from 'vitest';
import { makeAliasPattern, matchesAlias } from './characterMatching';

describe('makeAliasPattern — ё/е', () => {
  it('«Пётр» находится в тексте с «ё» и с «е»', () => {
    const p = makeAliasPattern('Пётр')!;
    expect(p.test('Пётр пришёл')).toBe(true);
    expect(p.test('Петр пришёл')).toBe(true);
  });

  it('длинное имя с «ё» находится в падежной форме', () => {
    const p = makeAliasPattern('Алёна')!;
    expect(p.test('Он ждал Алёну у ворот')).toBe(true);
    expect(p.test('Он ждал Алену у ворот')).toBe(true);
  });

  it('имя без «ё» находит текст с «ё»', () => {
    const p = makeAliasPattern('Семен')!;
    expect(p.test('Семён кивнул')).toBe(true);
  });

  it('не совпадает с частью другого слова', () => {
    const p = makeAliasPattern('Лев')!;
    expect(p.test('Налево')).toBe(false);
    expect(p.test('Лёв сказал')).toBe(true);
  });

  it('регистр не важен', () => {
    expect(makeAliasPattern('анна')!.test('АННА')).toBe(true);
  });
});

describe('matchesAlias', () => {
  it('нормализует обе стороны', () => {
    expect(matchesAlias('Фёдор', 'Федор')).toBe(true);
    expect(matchesAlias('Наташей', 'Наташа')).toBe(true);
    expect(matchesAlias('Ан', 'Анна')).toBe(false);
  });
});
