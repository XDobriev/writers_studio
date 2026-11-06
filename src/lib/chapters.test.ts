import { describe, it, expect, vi } from 'vitest';

const insertMock = vi.fn();
const selectMock = vi.fn();

vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      insert: (...args: unknown[]) => {
        insertMock(...args);
        return {
          select: (...sArgs: unknown[]) => {
            selectMock(...sArgs);
            return Promise.resolve({
              data: args[0] ? (args[0] as Array<Record<string, unknown>>).map((r, i) => ({
                id: `ch-${i}`,
                ...r,
                status: 'draft',
                created_at: '2026-01-01',
                updated_at: '2026-01-01',
              })) : [],
              error: null,
            });
          },
        };
      },
    }),
  },
}));

import { countWords, createChaptersBulk } from './chapters';

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

describe('createChaptersBulk', () => {
  it('вставляет главы с явными bookId и userId, заполняя дефолтные значения', async () => {
    insertMock.mockClear();
    selectMock.mockClear();

    const items = [
      { title: 'Глава 1', content: '<p>Привет</p>', words: 1, position: 0 },
      { title: 'Глава 2' },
    ];

    const result = await createChaptersBulk('book-123', 'user-456', items);

    expect(insertMock).toHaveBeenCalledWith([
      {
        book_id: 'book-123',
        user_id: 'user-456',
        title: 'Глава 1',
        content: '<p>Привет</p>',
        words: 1,
        synopsis: '',
        position: 0,
      },
      {
        book_id: 'book-123',
        user_id: 'user-456',
        title: 'Глава 2',
        content: '',
        words: 0,
        synopsis: '',
        position: 1,
      },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Глава 1');
    expect(result[1].title).toBe('Глава 2');
  });

  it('при пустом списке элементов не обращается к БД и возвращает пустой массив', async () => {
    insertMock.mockClear();
    const result = await createChaptersBulk('book-123', 'user-456', []);
    expect(insertMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
