import { describe, it, expect } from 'vitest';
import { countWords } from './chapters';

describe('countWords', () => {
  it('пустая строка → 0', () => {
    expect(countWords('')).toBe(0);
  });

  it('plain text считает слова', () => {
    expect(countWords('Привет мир')).toBe(2);
  });

  it('HTML-теги не считаются словами', () => {
    expect(countWords('<p>Один <strong>два</strong> три</p>')).toBe(3);
  });

  it('HTML-сущности не считаются словами', () => {
    expect(countWords('<p>Слово&nbsp;другое</p>')).toBe(2);
  });

  it('style и script блоки полностью игнорируются', () => {
    expect(countWords('<style>body { color: red }</style>Текст')).toBe(1);
    expect(countWords('<script>const x = 1</script>Текст')).toBe(1);
  });

  it('дефисные слова считаются как одно слово', () => {
    expect(countWords('Ростов-на-Дону')).toBe(1);
  });

  it('только пробелы и теги → 0', () => {
    expect(countWords('<p>   </p>')).toBe(0);
  });
});
