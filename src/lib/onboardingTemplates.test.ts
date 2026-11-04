// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  STORY_TEMPLATES,
  GENTLE_GOALS,
  isSampleBook,
  createBookFromTemplate,
  cloneSampleBook,
  SAMPLE_BOOK_TITLE,
  SAMPLE_BOOK_AUTHOR,
  SAMPLE_BOOK_TAG,
} from './onboardingTemplates';
import type { Book } from './supabase';

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  },
}));

vi.mock('./books', () => ({
  createBook: vi.fn(async (input: { user_id: string; title: string; goal: number }) => ({
    id: 'mock-book-id',
    user_id: input.user_id,
    title: input.title,
    goal: input.goal,
    words: 0,
    genres: [],
    genre: null,
    author: null,
    cover: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    daily_goal: 0,
    imported_words: 0,
    map_bg_url: null,
    map_template: null,
    series_id: null,
    series_order: null,
    share_token: null,
  })),
}));

vi.mock('./chapters', () => ({
  createChaptersBulk: vi.fn(async (_bookId: string, _userId: string, items: { title: string; synopsis?: string }[]) => {
    return items.map((it, i) => ({
      id: `mock-ch-${i}`,
      book_id: _bookId,
      user_id: _userId,
      title: it.title,
      position: i,
      synopsis: it.synopsis ?? '',
      words: 0,
      status: 'draft' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
  }),
}));

describe('onboardingTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('STORY_TEMPLATES', () => {
    it('содержит 3 стартовых шаблона (чистый лист, трехактная структура, путь героя)', () => {
      expect(STORY_TEMPLATES).toHaveLength(3);
      expect(STORY_TEMPLATES.map((t) => t.id)).toEqual(['blank', 'three-act', 'hero-journey']);
    });

    it('чистый лист содержит 1 главу', () => {
      const blank = STORY_TEMPLATES.find((t) => t.id === 'blank')!;
      expect(blank.chapters).toHaveLength(1);
      expect(blank.chapters[0].title).toBe('Глава 1');
    });

    it('трехактная структура содержит 7 структурированных глав с синопсисами', () => {
      const threeAct = STORY_TEMPLATES.find((t) => t.id === 'three-act')!;
      expect(threeAct.chapters).toHaveLength(7);
      threeAct.chapters.forEach((ch) => {
        expect(ch.title).toBeTruthy();
        expect(ch.synopsis).toBeTruthy();
      });
    });

    it('путь героя содержит 9 глав мономифа с синопсисами', () => {
      const hero = STORY_TEMPLATES.find((t) => t.id === 'hero-journey')!;
      expect(hero.chapters).toHaveLength(9);
      hero.chapters.forEach((ch) => {
        expect(ch.title).toBeTruthy();
        expect(ch.synopsis).toBeTruthy();
      });
    });
  });

  describe('GENTLE_GOALS', () => {
    it('содержит 4 щадящих планки цели (300 слов, 500 слов, 10 000 знаков, без цели)', () => {
      expect(GENTLE_GOALS).toHaveLength(4);
      expect(GENTLE_GOALS.map((g) => g.id)).toEqual(['300w', '500w', '10kch', 'free']);
      expect(GENTLE_GOALS.find((g) => g.id === '300w')?.words).toBe(300);
      expect(GENTLE_GOALS.find((g) => g.id === '500w')?.words).toBe(500);
      expect(GENTLE_GOALS.find((g) => g.id === '10kch')?.words).toBe(1600);
      expect(GENTLE_GOALS.find((g) => g.id === 'free')?.words).toBe(0);
    });
  });

  describe('isSampleBook', () => {
    it('возвращает false для null/undefined', () => {
      expect(isSampleBook(null)).toBe(false);
      expect(isSampleBook(undefined)).toBe(false);
    });

    it('возвращает true если в genres есть метка Демо-книга', () => {
      const book = { genres: ['Фэнтези', SAMPLE_BOOK_TAG], title: 'Любая' } as unknown as Book;
      expect(isSampleBook(book)).toBe(true);
    });

    it('возвращает true для названия романа Город, которого нет и Анны Корвин', () => {
      const book = { title: SAMPLE_BOOK_TITLE, author: SAMPLE_BOOK_AUTHOR, genres: [] } as unknown as Book;
      expect(isSampleBook(book)).toBe(true);
    });

    it('возвращает true если в localStorage сохранён флаг sample_book_', () => {
      const book = { id: 'sample-123', title: 'Черновик', author: 'Иван', genres: [] } as unknown as Book;
      localStorage.setItem('sample_book_sample-123', 'true');
      expect(isSampleBook(book)).toBe(true);
    });

    it('возвращает false для обычной книги автора', () => {
      const book = { id: 'book-456', title: 'Мой роман', author: 'Я', genres: ['Детектив'] } as unknown as Book;
      expect(isSampleBook(book)).toBe(false);
    });
  });

  describe('createBookFromTemplate', () => {
    it('создает книгу и пакет глав по трехактной структуре', async () => {
      const { createBook } = await import('./books');
      const { createChaptersBulk } = await import('./chapters');

      const book = await createBookFromTemplate('user-1', {
        title: 'Моя книга',
        templateId: 'three-act',
        goalWords: 500,
      });

      expect(book.title).toBe('Моя книга');
      expect(createBook).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          title: 'Моя книга',
          goal: 500,
        }),
      );
      expect(createChaptersBulk).toHaveBeenCalledWith(
        'mock-book-id',
        'user-1',
        expect.arrayContaining([
          expect.objectContaining({ title: expect.stringContaining('Обычный мир') }),
          expect.objectContaining({ title: expect.stringContaining('Кульминация') }),
        ]),
      );
    });
  });

  describe('cloneSampleBook', () => {
    it('клонирует Город которого нет с главами, персонажами и событиями', async () => {
      const { createBook } = await import('./books');
      const { createChaptersBulk } = await import('./chapters');
      const { supabase } = await import('./supabase');

      const book = await cloneSampleBook('user-1');
      expect(book.title).toBe(SAMPLE_BOOK_TITLE);
      expect(createBook).toHaveBeenCalledWith(
        expect.objectContaining({
          title: SAMPLE_BOOK_TITLE,
          author: SAMPLE_BOOK_AUTHOR,
          genres: expect.arrayContaining([SAMPLE_BOOK_TAG]),
        }),
      );
      expect(createChaptersBulk).toHaveBeenCalled();
      expect(supabase.from).toHaveBeenCalledWith('characters');
      expect(supabase.from).toHaveBeenCalledWith('locations');
      expect(supabase.from).toHaveBeenCalledWith('timeline_events');
      expect(localStorage.getItem('sample_book_mock-book-id')).toBe('true');
    });
  });
});
