import { describe, it, expect } from 'vitest';
import { formatAuthorMetrics, plural, pluralDays, fmtNumber } from './i18n';

describe('formatAuthorMetrics', () => {
  it('возвращает нули для 0 или отрицательных значений', () => {
    expect(formatAuthorMetrics(0)).toEqual({
      sheets: '0\u00A0а.\u00A0л.',
      pages: '0\u00A0авторских страниц',
      summary: '0\u00A0а.\u00A0л. · 0\u00A0авторских страниц',
    });
    expect(formatAuthorMetrics(-5)).toEqual({
      sheets: '0\u00A0а.\u00A0л.',
      pages: '0\u00A0авторских страниц',
      summary: '0\u00A0а.\u00A0л. · 0\u00A0авторских страниц',
    });
  });

  it('обрабатывает малые объемы текста (< 135 слов и < 600 слов)', () => {
    const small = formatAuthorMetrics(50);
    expect(small.sheets).toBe('<\u00A00,1\u00A0а.\u00A0л.');
    expect(small.pages).toBe('<\u00A01\u00A0авторской страницы');
    expect(small.summary).toBe('<\u00A00,1\u00A0а.\u00A0л. · <\u00A01\u00A0авторской страницы');

    const onePage = formatAuthorMetrics(270);
    expect(onePage.sheets).toBe('<\u00A00,1\u00A0а.\u00A0л.');
    expect(onePage.pages).toBe('1\u00A0авторская страница');
  });

  it('рассчитывает авторские листы и страницы для стандартных объемов', () => {
    const oneSheet = formatAuthorMetrics(6000);
    expect(oneSheet.sheets).toBe('1,0\u00A0а.\u00A0л.');
    expect(oneSheet.pages).toBe('22\u00A0авторские страницы');

    const novel = formatAuthorMetrics(65432);
    expect(novel.sheets).toBe('10,9\u00A0а.\u00A0л.');
    expect(novel.pages).toBe('242\u00A0авторские страницы');
    expect(novel.summary).toBe('10,9\u00A0а.\u00A0л. · 242\u00A0авторские страницы');
  });
});

describe('fmtNumber, plural, pluralDays', () => {
  it('форматирует числа с пробелами', () => {
    expect(fmtNumber(12345).replace(/\u00A0/g, ' ')).toBe('12 345');
  });

  it('склоняет дни и слова', () => {
    expect(plural(1, 'слово', 'слова', 'слов')).toBe('слово');
    expect(plural(2, 'слово', 'слова', 'слов')).toBe('слова');
    expect(plural(5, 'слово', 'слова', 'слов')).toBe('слов');
    expect(pluralDays(21)).toBe('день');
  });
});
