// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  analyzeSplits,
  getChapterParagraphPreviews,
  isChapterLine,
  joinChapters,
  mergeChapterWithPrevious,
  splitChapterByCharOffset,
  splitChapterByParagraph,
  splitManuscript,
  type ImportedChapter,
} from './importSplit';

describe('isChapterLine', () => {
  it('распознает стандартные заголовки глав', () => {
    expect(isChapterLine('Глава 1')).toBe(true);
    expect(isChapterLine('Глава 1. Начало пути')).toBe(true);
    expect(isChapterLine('ГЛАВА ПЕРВАЯ')).toBe(true);
    expect(isChapterLine('Глава IV')).toBe(true);
    expect(isChapterLine('Часть 2')).toBe(true);
    expect(isChapterLine('Пролог')).toBe(true);
    expect(isChapterLine('Эпилог')).toBe(true);
    expect(isChapterLine('Chapter 5')).toBe(true);
    expect(isChapterLine('Prologue')).toBe(true);
  });

  it('отклоняет длинные предложения, где слово "глава" — часть фразы', () => {
    expect(
      isChapterLine(
        'Глава 1 была написана очень давно, когда автор еще жил в деревне и мечтал о путешествиях по всему миру.',
      ),
    ).toBe(false);
  });

  it('отклоняет пустые и несвязанные строки', () => {
    expect(isChapterLine('')).toBe(false);
    expect(isChapterLine('   ')).toBe(false);
    expect(isChapterLine('Обычный абзац текста без номера главы.')).toBe(false);
  });
});

describe('splitManuscript and analyzeSplits', () => {
  const units = [
    {
      html: '<h1>Глава 1</h1><p>Первый абзац первой главы.</p><h1>Глава 2</h1><p>Первый абзац второй главы.</p>',
    },
  ];

  it('splitManuscript mode="headings" режет по h1/h2', () => {
    const chapters = splitManuscript(units, 'headings', 'Тестовая книга');
    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe('Глава 1');
    expect(chapters[1].title).toBe('Глава 2');
    expect(chapters[0].words).toBeGreaterThan(0);
    expect(chapters[1].words).toBeGreaterThan(0);
  });

  it('splitManuscript mode="single" создает одну главу', () => {
    const chapters = splitManuscript(units, 'single', 'Тестовая книга');
    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe('Глава 1');
  });

  it('analyzeSplits выдает доступные варианты разбивки', () => {
    const analysis = analyzeSplits(units, 'Тестовая книга');
    expect(analysis.options).toEqual([
      { mode: 'headings', count: 2 },
      { mode: 'pattern', count: 2 },
      { mode: 'single', count: 1 },
    ]);
    expect(analysis.defaultMode).toBe('headings');
  });
});

describe('joinChapters', () => {
  const chapters: ImportedChapter[] = [
    { title: 'Глава 1', html: '<p>Текст первой главы.</p>', words: 3 },
    { title: 'Глава 2', html: '<p>Текст второй главы.</p>', words: 3 },
    { title: 'Глава 3', html: '<p>Текст третьей главы.</p>', words: 3 },
  ];

  it('склеивает выбранные главы и сохраняет название подзаголовком', () => {
    // Склеиваем главу 1 (индекс 1) с предыдущей (индекс 0)
    const joined = joinChapters(chapters, new Set([1]));
    expect(joined).toHaveLength(2);
    expect(joined[0].first).toBe(0);
    expect(joined[0].last).toBe(1);
    expect(joined[0].title).toBe('Глава 1');
    expect(joined[0].html).toContain('<h2>Глава 2</h2>');
    expect(joined[0].html).toContain('<p>Текст второй главы.</p>');
    expect(joined[0].words).toBe(6);
    expect(joined[1].title).toBe('Глава 3');
  });
});

describe('mergeChapterWithPrevious', () => {
  const chapters: ImportedChapter[] = [
    { title: 'Глава 1', html: '<p>Первая глава.</p>', words: 2 },
    { title: 'Глава 2', html: '<p>Вторая глава.</p>', words: 2 },
    { title: 'Глава 3', html: '<p>Третья глава.</p>', words: 2 },
  ];

  it('склеивает главу со второй позиции с первой главой', () => {
    const merged = mergeChapterWithPrevious(chapters, 1);
    expect(merged).toHaveLength(2);
    expect(merged[0].title).toBe('Глава 1');
    expect(merged[0].html).toContain('<h2>Глава 2</h2>');
    expect(merged[0].html).toContain('<p>Вторая глава.</p>');
    expect(merged[0].words).toBe(6); // "Первая глава", "Глава 2", "Вторая глава" = 6 слов
    expect(merged[1].title).toBe('Глава 3');
  });

  it('склеивает последнюю главу с предпоследней', () => {
    const merged = mergeChapterWithPrevious(chapters, 2);
    expect(merged).toHaveLength(2);
    expect(merged[0].title).toBe('Глава 1');
    expect(merged[1].title).toBe('Глава 2');
    expect(merged[1].html).toContain('<h2>Глава 3</h2>');
  });

  it('при недопустимом индексе (0, отрицательный, больше длины) возвращает копию массива', () => {
    expect(mergeChapterWithPrevious(chapters, 0)).toEqual(chapters);
    expect(mergeChapterWithPrevious(chapters, -1)).toEqual(chapters);
    expect(mergeChapterWithPrevious(chapters, 99)).toEqual(chapters);
  });
});

describe('splitChapterByParagraph', () => {
  const chapter: ImportedChapter = {
    title: 'Глава 1',
    html: '<p>Первый абзац.</p><p>Второй абзац.</p><p>Третий абзац.</p><p>Четвертый абзац.</p>',
    words: 8,
  };

  it('делит главу по индексу абзаца с сохранением заголовка и пересчетом слов', () => {
    const [part1, part2] = splitChapterByParagraph(chapter, 2);

    expect(part1.title).toBe('Глава 1');
    expect(part1.html).toBe('<p>Первый абзац.</p><p>Второй абзац.</p>');
    expect(part1.words).toBe(4);

    expect(part2.title).toBe('Глава 1 (продолжение)');
    expect(part2.html).toBe('<p>Третий абзац.</p><p>Четвертый абзац.</p>');
    expect(part2.words).toBe(4);
  });

  it('принимает кастомное название для второй части', () => {
    const [, part2] = splitChapterByParagraph(chapter, 1, 'Глава 2. Новые горизонты');
    expect(part2.title).toBe('Глава 2. Новые горизонты');
    expect(part2.html).toBe('<p>Второй абзац.</p><p>Третий абзац.</p><p>Четвертый абзац.</p>');
    expect(part2.words).toBe(6);
  });

  it('выбрасывает RangeError при недопустимом индексе абзаца', () => {
    expect(() => splitChapterByParagraph(chapter, 0)).toThrow(RangeError);
    expect(() => splitChapterByParagraph(chapter, 4)).toThrow(RangeError);
    expect(() => splitChapterByParagraph(chapter, -1)).toThrow(RangeError);
    expect(() => splitChapterByParagraph(chapter, 10)).toThrow(RangeError);
  });

  it('глава из одного абзаца не может быть разделена по абзацу', () => {
    const singlePChapter: ImportedChapter = {
      title: 'Короткая',
      html: '<p>Единственный абзац.</p>',
      words: 2,
    };
    expect(() => splitChapterByParagraph(singlePChapter, 1)).toThrow(RangeError);
  });
});

describe('splitChapterByCharOffset', () => {
  const chapter: ImportedChapter = {
    title: 'Глава 1',
    html: '<p>Длинный первый абзац текста.</p><p>Второй абзац текста книги.</p>',
    words: 8,
  };

  it('делит абзац пополам при смещении внутри абзаца', () => {
    // В первом абзаце "Длинный первый абзац текста." (длина 28 символов).
    // Режем на 15 символе: "Длинный первый " | "абзац текста."
    const [part1, part2] = splitChapterByCharOffset(chapter, 15);

    expect(part1.title).toBe('Глава 1');
    expect(part1.html).toContain('<p>Длинный первый</p>');
    expect(part1.words).toBe(2);

    expect(part2.title).toBe('Глава 1 (продолжение)');
    expect(part2.html).toContain('<p>абзац текста.</p>');
    expect(part2.html).toContain('<p>Второй абзац текста книги.</p>');
    expect(part2.words).toBe(6);
  });

  it('делит на границе элементов, если смещение совпадает с концом первого элемента', () => {
    // Первый элемент имеет длину 28 символов
    const [part1, part2] = splitChapterByCharOffset(chapter, 28, 'Вторая половина');

    expect(part1.title).toBe('Глава 1');
    expect(part1.html).toBe('<p>Длинный первый абзац текста.</p>');
    expect(part1.words).toBe(4);

    expect(part2.title).toBe('Вторая половина');
    expect(part2.html).toBe('<p>Второй абзац текста книги.</p>');
    expect(part2.words).toBe(4);
  });

  it('выбрасывает RangeError при недопустимом смещении', () => {
    expect(() => splitChapterByCharOffset(chapter, 0)).toThrow(RangeError);
    expect(() => splitChapterByCharOffset(chapter, -5)).toThrow(RangeError);
    expect(() => splitChapterByCharOffset(chapter, 1000)).toThrow(RangeError);
  });

  it('выбрасывает RangeError для пустой главы', () => {
    const emptyChapter: ImportedChapter = {
      title: 'Пустая',
      html: '',
      words: 0,
    };
    expect(() => splitChapterByCharOffset(emptyChapter, 1)).toThrow(RangeError);
  });

  it('корректно делит главу из трех абзацев на произвольном символе второго абзаца', () => {
    const threePChapter: ImportedChapter = {
      title: 'Глава 3',
      html: '<p>Раз два.</p><p>Три четыре пять.</p><p>Шесть семь.</p>',
      words: 7,
    };
    // p1 = "Раз два." (8 символов).
    // p2 = "Три четыре пять." (16 символов).
    // Режем на 8 + 4 = 12 символе (после "Три "):
    const [part1, part2] = splitChapterByCharOffset(threePChapter, 12);
    expect(part1.html).toContain('<p>Раз два.</p>');
    expect(part1.html).toContain('<p>Три</p>');
    expect(part2.html).toContain('<p>четыре пять.</p>');
    expect(part2.html).toContain('<p>Шесть семь.</p>');
    expect(part1.words + part2.words).toBe(7);
  });
});

describe('getChapterParagraphPreviews', () => {
  it('извлекает абзацы из HTML-разметки', () => {
    const html = '<p>Первый абзац.</p><p>Второй абзац.</p><p>Третий абзац.</p>';
    const previews = getChapterParagraphPreviews(html);
    expect(previews).toHaveLength(3);
    expect(previews[0]).toEqual({ index: 0, text: 'Первый абзац.' });
    expect(previews[1]).toEqual({ index: 1, text: 'Второй абзац.' });
    expect(previews[2]).toEqual({ index: 2, text: 'Третий абзац.' });
  });

  it('работает с текстом без HTML-тегов через разбивку по переводам строк', () => {
    const plain = 'Строка один\n\nСтрока два';
    const previews = getChapterParagraphPreviews(plain);
    expect(previews).toHaveLength(2);
    expect(previews[0]).toEqual({ index: 0, text: 'Строка один' });
    expect(previews[1]).toEqual({ index: 1, text: 'Строка два' });
  });

  it('возвращает пустой массив для пустого содержимого', () => {
    expect(getChapterParagraphPreviews('')).toEqual([]);
    expect(getChapterParagraphPreviews('   ')).toEqual([]);
  });
});
