import { vi, describe, it, expect } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

import { extractCharacterMentions } from './crossrefs';

describe('extractCharacterMentions — кириллица', () => {
  it('находит имя в простом тексте', () => {
    expect(extractCharacterMentions('Алиса пошла домой', ['Алиса'])).toBe(true);
  });

  it('совпадает без учёта регистра', () => {
    expect(extractCharacterMentions('алиса пошла домой', ['Алиса'])).toBe(true);
    expect(extractCharacterMentions('АЛИСА', ['алиса'])).toBe(true);
  });

  it('не совпадает с частичным вхождением (Алисандра ≠ Алиса)', () => {
    expect(extractCharacterMentions('Алисандра ждала', ['Алиса'])).toBe(false);
  });

  it('совпадает с именем в начале вхождения без суффикса', () => {
    expect(extractCharacterMentions('Алиса!', ['Алиса'])).toBe(true);
  });

  it('срезает HTML перед поиском', () => {
    expect(
      extractCharacterMentions('<p><strong>Алиса</strong> пришла домой.</p>', ['Алиса']),
    ).toBe(true);
  });

  it('возвращает false если имя отсутствует', () => {
    expect(extractCharacterMentions('Боря пошёл в магазин', ['Алиса'])).toBe(false);
  });

  it('возвращает true при совпадении любого alias', () => {
    expect(extractCharacterMentions('Аля вернулась', ['Алиса', 'Аля'])).toBe(true);
  });

  it('пропускает пустые aliases', () => {
    expect(extractCharacterMentions('Алиса', ['', '   '])).toBe(false);
  });

  it('возвращает false на пустом контенте', () => {
    expect(extractCharacterMentions('', ['Алиса'])).toBe(false);
  });

  it('возвращает false на пустом списке aliases', () => {
    expect(extractCharacterMentions('Алиса дома', [])).toBe(false);
  });

  it('совпадает с латиницей в mixed-тексте', () => {
    expect(extractCharacterMentions('Привет, John!', ['John'])).toBe(true);
  });

  it('не совпадает со строкой внутри слова (латиница)', () => {
    expect(extractCharacterMentions('Johnson came', ['John'])).toBe(false);
  });

  it('совпадает в середине предложения через запятую', () => {
    expect(extractCharacterMentions('пришёл Борис, сел', ['Борис'])).toBe(true);
  });
});
