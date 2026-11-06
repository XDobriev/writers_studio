// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LITERARY_FORMS,
  createBookFromLiteraryForm,
  cloneSampleBook,
  isSampleBook,
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
  createBook: vi.fn(),
  createBookWithSeriesTransfer: vi.fn(),
  deleteBook: vi.fn(),
}));

vi.mock('./chapters', () => ({
  createChaptersBulk: vi.fn(),
}));

import { createBook, createBookWithSeriesTransfer, deleteBook } from './books';
import { createChaptersBulk } from './chapters';

describe('onboardingTemplates: LITERARY_FORMS', () => {
  it('содержит 4 литературные формы с корректными целями слов', () => {
    expect(LITERARY_FORMS).toHaveLength(4);
    const ids = LITERARY_FORMS.map((f) => f.id);
    expect(ids).toEqual(['novel', 'novella', 'short_story', 'free']);

    const novel = LITERARY_FORMS.find((f) => f.id === 'novel');
    expect(novel?.targetWords).toBe(70000);
    expect(novel?.title).toBe('Роман');
    expect(novel?.subtitle).toBe('Стандарт большой прозы');
    expect(novel?.description).toBeTruthy();

    const novella = LITERARY_FORMS.find((f) => f.id === 'novella');
    expect(novella?.targetWords).toBe(30000);
    expect(novella?.title).toBe('Повесть');
    expect(novella?.subtitle).toBe('Компактная история');

    const shortStory = LITERARY_FORMS.find((f) => f.id === 'short_story');
    expect(shortStory?.targetWords).toBe(5000);
    expect(shortStory?.title).toBe('Рассказ');
    expect(shortStory?.subtitle).toBe('Малая форма');

    const free = LITERARY_FORMS.find((f) => f.id === 'free');
    expect(free?.targetWords).toBeNull();
    expect(free?.title).toBe('Свободный объём');
    expect(free?.subtitle).toBe('Чистый лист');
  });
});

describe('createBookFromLiteraryForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('создает роман с переданными жанрами, обложкой и целью', async () => {
    const mockBook = { id: 'book-novel-1', title: 'Остров бурь', user_id: 'u-1', target_words: 70000 };
    vi.mocked(createBook).mockResolvedValueOnce(mockBook as any);
    vi.mocked(createChaptersBulk).mockResolvedValueOnce([{ id: 'c-1', book_id: 'book-novel-1', title: 'Глава 1' }] as any);

    const result = await createBookFromLiteraryForm('u-1', {
      title: 'Остров бурь',
      formId: 'novel',
      targetWords: 70000,
      genres: ['Фэнтези', 'Остросюжетный боевик с элементами фантастики'],
      cover: '#7c1d1d',
    });

    expect(createBook).toHaveBeenCalledWith({
      title: 'Остров бурь',
      user_id: 'u-1',
      genres: ['Фэнтези', 'Остросюжетный боевик с элементами фантастики'],
      target_words: 70000,
      cover: '#7c1d1d',
    });
    expect(createChaptersBulk).toHaveBeenCalledWith('book-novel-1', 'u-1', [
      { title: 'Глава 1', position: 0, content: '', words: 0 },
    ]);
    expect(result).toBe(mockBook);
  });

  it('откатывает книгу через deleteBook при ошибке вставки первой главы', async () => {
    const mockBook = { id: 'book-fail-1', title: 'Сбойная книга', user_id: 'u-1' };
    vi.mocked(createBook).mockResolvedValueOnce(mockBook as any);
    vi.mocked(createChaptersBulk).mockRejectedValueOnce(new Error('DB chapter insert error'));
    vi.mocked(deleteBook).mockResolvedValueOnce(undefined);

    await expect(
      createBookFromLiteraryForm('u-1', {
        title: 'Сбойная книга',
        formId: 'novel',
      }),
    ).rejects.toThrow('DB chapter insert error');

    expect(deleteBook).toHaveBeenCalledWith('book-fail-1');
  });

  it('использует createBookWithSeriesTransfer, если передана серия', async () => {
    const mockBook = { id: 'book-series-2', title: 'Том 2' };
    vi.mocked(createBookWithSeriesTransfer).mockResolvedValueOnce(mockBook as any);

    const transfer = {
      enabled: true,
      sourceBookId: 'book-1',
      characters: true,
      locationsMap: true,
      notes: true,
      timeline: false,
    };

    await createBookFromLiteraryForm('u-1', {
      title: 'Том 2',
      formId: 'novel',
      targetWords: 70000,
      genres: ['Фэнтези'],
      cover: '#1c3a4a',
      seriesTransfer: transfer,
    });

    expect(createBookWithSeriesTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Том 2', target_words: 70000 }),
      transfer,
    );
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

describe('cloneSampleBook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('клонирует Город которого нет с главами, персонажами и событиями', async () => {
    const mockBook = {
      id: 'mock-book-id',
      title: SAMPLE_BOOK_TITLE,
      author: SAMPLE_BOOK_AUTHOR,
    };
    vi.mocked(createBook).mockResolvedValueOnce(mockBook as any);

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
    const { supabase } = await import('./supabase');
    expect(supabase.from).toHaveBeenCalledWith('characters');
    expect(supabase.from).toHaveBeenCalledWith('locations');
    expect(supabase.from).toHaveBeenCalledWith('timeline_events');
    expect(localStorage.getItem('sample_book_mock-book-id')).toBe('true');
  });

  it('откатывает созданную книгу при сбое добавления глав или персонажей', async () => {
    const mockBook = {
      id: 'mock-book-id',
      title: SAMPLE_BOOK_TITLE,
      author: SAMPLE_BOOK_AUTHOR,
    };
    vi.mocked(createBook).mockResolvedValueOnce(mockBook as any);
    vi.mocked(createChaptersBulk).mockRejectedValueOnce(new Error('Network error on chapters'));
    vi.mocked(deleteBook).mockResolvedValueOnce(undefined);

    await expect(cloneSampleBook('user-1')).rejects.toThrow('Network error on chapters');
    expect(deleteBook).toHaveBeenCalledWith('mock-book-id');
  });
});
