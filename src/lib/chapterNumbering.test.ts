import { describe, it, expect } from 'vitest';
import {
  parseChapterTitle,
  formatChapterTitle,
  extractSubtitle,
  computeChapterRanks,
  getNextChapterTitle,
  recalculateBookChapterTitles,
  getChaptersNeedingRenumber
} from './chapterNumbering';

describe('chapterNumbering', () => {
  describe('parseChapterTitle', () => {
    it('распознаёт стандартную нумерованную главу', () => {
      expect(parseChapterTitle('Глава 1')).toEqual({
        type: 'regular',
        number: 1,
        subtitle: '',
        separator: '',
        rawTitle: 'Глава 1',
      });
      expect(parseChapterTitle('Глава 42')).toEqual({
        type: 'regular',
        number: 42,
        subtitle: '',
        separator: '',
        rawTitle: 'Глава 42',
      });
    });

    it('распознаёт главу с подзаголовком и разными разделителями', () => {
      expect(parseChapterTitle('Глава 1. Пробуждение')).toEqual({
        type: 'regular',
        number: 1,
        subtitle: 'Пробуждение',
        separator: '.',
        rawTitle: 'Глава 1. Пробуждение',
      });
      expect(parseChapterTitle('Глава 2: Тени прошлого')).toEqual({
        type: 'regular',
        number: 2,
        subtitle: 'Тени прошлого',
        separator: ':',
        rawTitle: 'Глава 2: Тени прошлого',
      });
      expect(parseChapterTitle('Глава 3 — Битва')).toEqual({
        type: 'regular',
        number: 3,
        subtitle: 'Битва',
        separator: '—',
        rawTitle: 'Глава 3 — Битва',
      });
      expect(parseChapterTitle('Chapter 5 - The Castle')).toEqual({
        type: 'regular',
        number: 5,
        subtitle: 'The Castle',
        separator: '-',
        rawTitle: 'Chapter 5 - The Castle',
      });
    });

    it('распознаёт Пролог', () => {
      expect(parseChapterTitle('Пролог')).toEqual({
        type: 'prologue',
        number: null,
        subtitle: '',
        separator: '',
        rawTitle: 'Пролог',
      });
      expect(parseChapterTitle('пролог')).toEqual({
        type: 'prologue',
        number: null,
        subtitle: '',
        separator: '',
        rawTitle: 'пролог',
      });
      expect(parseChapterTitle('Пролог. Начало пути')).toEqual({
        type: 'prologue',
        number: null,
        subtitle: 'Начало пути',
        separator: '.',
        rawTitle: 'Пролог. Начало пути',
      });
      expect(parseChapterTitle('Prologue: Genesis')).toEqual({
        type: 'prologue',
        number: null,
        subtitle: 'Genesis',
        separator: ':',
        rawTitle: 'Prologue: Genesis',
      });
    });

    it('распознаёт Эпилог', () => {
      expect(parseChapterTitle('Эпилог')).toEqual({
        type: 'epilogue',
        number: null,
        subtitle: '',
        separator: '',
        rawTitle: 'Эпилог',
      });
      expect(parseChapterTitle('Эпилог. Спустя десять лет')).toEqual({
        type: 'epilogue',
        number: null,
        subtitle: 'Спустя десять лет',
        separator: '.',
        rawTitle: 'Эпилог. Спустя десять лет',
      });
      expect(parseChapterTitle('Epilogue')).toEqual({
        type: 'epilogue',
        number: null,
        subtitle: '',
        separator: '',
        rawTitle: 'Epilogue',
      });
    });

    it('распознаёт Интерлюдию', () => {
      expect(parseChapterTitle('Интерлюдия')).toEqual({
        type: 'interlude',
        number: null,
        subtitle: '',
        separator: '',
        rawTitle: 'Интерлюдия',
      });
      expect(parseChapterTitle('Интерлюдия. Голос из бездны')).toEqual({
        type: 'interlude',
        number: null,
        subtitle: 'Голос из бездны',
        separator: '.',
        rawTitle: 'Интерлюдия. Голос из бездны',
      });
      expect(parseChapterTitle('Interlude - Between Worlds')).toEqual({
        type: 'interlude',
        number: null,
        subtitle: 'Between Worlds',
        separator: '-',
        rawTitle: 'Interlude - Between Worlds',
      });
    });

    it('распознаёт служебные главы по ключевым словам и произвольные без номера', () => {
      expect(parseChapterTitle('Предисловие')).toEqual({
        type: 'special',
        number: null,
        subtitle: '',
        separator: '',
        rawTitle: 'Предисловие',
      });
      expect(parseChapterTitle('От автора')).toEqual({
        type: 'special',
        number: null,
        subtitle: '',
        separator: '',
        rawTitle: 'От автора',
      });
      expect(parseChapterTitle('Послесловие. Благодарности')).toEqual({
        type: 'special',
        number: null,
        subtitle: 'Благодарности',
        separator: '.',
        rawTitle: 'Послесловие. Благодарности',
      });
      expect(parseChapterTitle('Служебная глава')).toEqual({
        type: 'special',
        number: null,
        subtitle: '',
        separator: '',
        rawTitle: 'Служебная глава',
      });
      expect(parseChapterTitle('Заметки на полях')).toEqual({
        type: 'special',
        number: null,
        subtitle: '',
        separator: '',
        rawTitle: 'Заметки на полях',
      });
    });
  });

  describe('formatChapterTitle', () => {
    it('форматирует регулярную главу с номером и без подзаголовка', () => {
      expect(formatChapterTitle('regular', 1)).toBe('Глава 1');
      expect(formatChapterTitle('regular', 5)).toBe('Глава 5');
    });

    it('форматирует регулярную главу с подзаголовком', () => {
      expect(formatChapterTitle('regular', 1, 'Пробуждение')).toBe('Глава 1. Пробуждение');
    });

    it('форматирует Пролог, Эпилог, Интерлюдию', () => {
      expect(formatChapterTitle('prologue', 1)).toBe('Пролог');
      expect(formatChapterTitle('prologue', 1, 'Начало')).toBe('Пролог. Начало');
      expect(formatChapterTitle('epilogue', 1)).toBe('Эпилог');
      expect(formatChapterTitle('epilogue', 1, 'Финал')).toBe('Эпилог. Финал');
      expect(formatChapterTitle('interlude', 1)).toBe('Интерлюдия');
      expect(formatChapterTitle('interlude', 1, 'В замке')).toBe('Интерлюдия. В замке');
    });

    it('форматирует служебную главу', () => {
      expect(formatChapterTitle('special', 1)).toBe('Служебная глава');
      expect(formatChapterTitle('special', 1, 'От автора')).toBe('От автора');
      expect(formatChapterTitle('special', 1, 'Вороний пир')).toBe('Вороний пир');
    });

    it('конвертирует произвольное название в обычную главу с номером', () => {
      expect(formatChapterTitle('regular', 2, 'Вороний пир')).toBe('Глава 2. Вороний пир');
    });
  });

  describe('extractSubtitle', () => {
    it('извлекает подзаголовок из любого типа главы', () => {
      expect(extractSubtitle('Глава 1. Пробуждение')).toBe('Пробуждение');
      expect(extractSubtitle('Глава 1: Пробуждение')).toBe('Пробуждение');
      expect(extractSubtitle('Глава 1 — Пробуждение')).toBe('Пробуждение');
      expect(extractSubtitle('Глава 1')).toBe('');
      expect(extractSubtitle('Пролог. Начало')).toBe('Начало');
      expect(extractSubtitle('Пролог')).toBe('');
      expect(extractSubtitle('Интерлюдия. Голос')).toBe('Голос');
      expect(extractSubtitle('Служебная глава')).toBe('');
      expect(extractSubtitle('Заметки на полях')).toBe('Заметки на полях');
    });
  });

  describe('computeChapterRanks', () => {
    it('для книги только с обычными главами возвращает сквозную нумерацию', () => {
      const chapters = [
        { id: 'c1', title: 'Глава 1' },
        { id: 'c2', title: 'Глава 2. Тени' },
        { id: 'c3', title: 'Глава 3' },
      ];
      const ranks = computeChapterRanks(chapters);
      expect(ranks.get('c1')).toEqual({
        id: 'c1',
        type: 'regular',
        regularNumber: 1,
        displayNumber: '01',
        badgeLabel: 'ГЛ. 01',
        tocNumber: '1.',
      });
      expect(ranks.get('c2')).toEqual({
        id: 'c2',
        type: 'regular',
        regularNumber: 2,
        displayNumber: '02',
        badgeLabel: 'ГЛ. 02',
        tocNumber: '2.',
      });
      expect(ranks.get('c3')).toEqual({
        id: 'c3',
        type: 'regular',
        regularNumber: 3,
        displayNumber: '03',
        badgeLabel: 'ГЛ. 03',
        tocNumber: '3.',
      });
    });

    it('служебная глава не инкрементирует номер для следующих глав', () => {
      const chapters = [
        { id: 'c1', title: 'Пролог' },
        { id: 'c2', title: 'Глава 1. Пробуждение' },
        { id: 'c3', title: 'Глава 2' },
        { id: 'c4', title: 'Интерлюдия. В замке' },
        { id: 'c5', title: 'Глава 3. Битва' },
        { id: 'c6', title: 'Эпилог' },
      ];
      const ranks = computeChapterRanks(chapters);

      // Пролог — служебная, без номера
      expect(ranks.get('c1')).toEqual({
        id: 'c1',
        type: 'prologue',
        regularNumber: null,
        displayNumber: '—',
        badgeLabel: 'ПРОЛОГ',
        tocNumber: '—',
      });

      // Глава после Пролога — полноценная Глава 1!
      expect(ranks.get('c2')).toEqual({
        id: 'c2',
        type: 'regular',
        regularNumber: 1,
        displayNumber: '01',
        badgeLabel: 'ГЛ. 01',
        tocNumber: '1.',
      });

      // Глава 2
      expect(ranks.get('c3')).toEqual({
        id: 'c3',
        type: 'regular',
        regularNumber: 2,
        displayNumber: '02',
        badgeLabel: 'ГЛ. 02',
        tocNumber: '2.',
      });

      // Интерлюдия — служебная, не инкрементирует
      expect(ranks.get('c4')).toEqual({
        id: 'c4',
        type: 'interlude',
        regularNumber: null,
        displayNumber: '—',
        badgeLabel: 'ИНТЕРЛЮДИЯ',
        tocNumber: '—',
      });

      // Следующая глава — Глава 3
      expect(ranks.get('c5')).toEqual({
        id: 'c5',
        type: 'regular',
        regularNumber: 3,
        displayNumber: '03',
        badgeLabel: 'ГЛ. 03',
        tocNumber: '3.',
      });

      // Эпилог
      expect(ranks.get('c6')).toEqual({
        id: 'c6',
        type: 'epilogue',
        regularNumber: null,
        displayNumber: '—',
        badgeLabel: 'ЭПИЛОГ',
        tocNumber: '—',
      });
    });
  });

  describe('getNextChapterTitle', () => {
    it('возвращает "Глава 1", если глав нет', () => {
      expect(getNextChapterTitle([])).toBe('Глава 1');
    });

    it('возвращает "Глава 1", если есть только Пролог', () => {
      expect(getNextChapterTitle([{ title: 'Пролог' }])).toBe('Глава 1');
      expect(getNextChapterTitle([{ title: 'Пролог. Начало' }])).toBe('Глава 1');
    });

    it('возвращает "Глава 2", если есть Пролог и Глава 1', () => {
      expect(getNextChapterTitle([{ title: 'Пролог' }, { title: 'Глава 1' }])).toBe('Глава 2');
    });

    it('корректно парсит главу с подзаголовком (Глава 1. Пробуждение)', () => {
      expect(getNextChapterTitle([{ title: 'Пролог' }, { title: 'Глава 1. Пробуждение' }])).toBe('Глава 2');
    });
  });

  describe('recalculateBookChapterTitles', () => {
    const book = { book_id: 'b1', user_id: 'u1' };

    it('превращение первой главы в Пролог перенумеровывает последующие главы в Главу 1, Главу 2...', () => {
      const chapters = [
        { id: 'c1', title: 'Глава 1', ...book },
        { id: 'c2', title: 'Глава 2', ...book },
        { id: 'c3', title: 'Глава 3', ...book },
      ];

      const { updates, nextChapters } = recalculateBookChapterTitles(chapters, 'c1', 'prologue');

      expect(updates).toEqual([
        { id: 'c1', title: 'Пролог', ...book },
        { id: 'c2', title: 'Глава 1', ...book },
        { id: 'c3', title: 'Глава 2', ...book },
      ]);
      expect(nextChapters.map((c) => c.title)).toEqual(['Пролог', 'Глава 1', 'Глава 2']);
    });

    it('сохраняет подзаголовки глав при смене типа', () => {
      const chapters = [
        { id: 'c1', title: 'Глава 1. Начало', ...book },
        { id: 'c2', title: 'Глава 2. Путь', ...book },
      ];

      const { updates } = recalculateBookChapterTitles(chapters, 'c1', 'prologue');

      expect(updates).toEqual([
        { id: 'c1', title: 'Пролог. Начало', ...book },
        { id: 'c2', title: 'Глава 1. Путь', ...book },
      ]);
    });

    it('превращение Пролога обратно в обычную главу сдвигает нумерацию', () => {
      const chapters = [
        { id: 'c1', title: 'Пролог', ...book },
        { id: 'c2', title: 'Глава 1', ...book },
        { id: 'c3', title: 'Глава 2', ...book },
      ];

      const { updates, nextChapters } = recalculateBookChapterTitles(chapters, 'c1', 'regular');

      expect(updates).toEqual([
        { id: 'c1', title: 'Глава 1', ...book },
        { id: 'c2', title: 'Глава 2', ...book },
        { id: 'c3', title: 'Глава 3', ...book },
      ]);
      expect(nextChapters.map((c) => c.title)).toEqual(['Глава 1', 'Глава 2', 'Глава 3']);
    });

    it('превращение средней главы в Интерлюдию сохраняет правильную сквозную нумерацию', () => {
      const chapters = [
        { id: 'c1', title: 'Пролог', ...book },
        { id: 'c2', title: 'Глава 1', ...book },
        { id: 'c3', title: 'Глава 2. Тайны', ...book },
        { id: 'c4', title: 'Глава 3. Финал', ...book },
      ];

      const { updates, nextChapters } = recalculateBookChapterTitles(chapters, 'c3', 'interlude');

      expect(updates).toEqual([
        { id: 'c3', title: 'Интерлюдия. Тайны', ...book },
        { id: 'c4', title: 'Глава 2. Финал', ...book },
      ]);
      expect(nextChapters.map((c) => c.title)).toEqual(['Пролог', 'Глава 1', 'Интерлюдия. Тайны', 'Глава 2. Финал']);
    });

    it('превращение последней главы в Эпилог', () => {
      const chapters = [
        { id: 'c1', title: 'Глава 1', ...book },
        { id: 'c2', title: 'Глава 2', ...book },
      ];

      const { updates, nextChapters } = recalculateBookChapterTitles(chapters, 'c2', 'epilogue');

      expect(updates).toEqual([
        { id: 'c2', title: 'Эпилог', ...book },
      ]);
      expect(nextChapters.map((c) => c.title)).toEqual(['Глава 1', 'Эпилог']);
    });
  });

  describe('getChaptersNeedingRenumber', () => {
    const book = { book_id: 'b1', user_id: 'u1' };

    it('возвращает пустой массив, если нумерация корректна с Прологом', () => {
      const chapters = [
        { id: 'c1', title: 'Пролог', ...book },
        { id: 'c2', title: 'Глава 1', ...book },
        { id: 'c3', title: 'Глава 2', ...book },
      ];
      expect(getChaptersNeedingRenumber(chapters)).toEqual([]);
    });

    it('находит главы с нарушенной нумерацией после Пролога', () => {
      const chapters = [
        { id: 'c1', title: 'Пролог', ...book },
        { id: 'c2', title: 'Глава 2', ...book }, // Должна быть 1
        { id: 'c3', title: 'Глава 3', ...book }, // Должна быть 2
      ];
      expect(getChaptersNeedingRenumber(chapters)).toEqual([
        { id: 'c2', title: 'Глава 1', ...book },
        { id: 'c3', title: 'Глава 2', ...book },
      ]);
    });
  });
});
