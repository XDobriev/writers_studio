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

import { countChars, countWords, createChaptersBulk } from './chapters';

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

  it('инлайн-теги внутри слова не разбивают его на части', () => {
    expect(countWords('<p><strong>П</strong>ривет</p>')).toBe(1);
    expect(countWords('<p><span>доб</span><em>рый</em> день</p>')).toBe(2);
  });

  it('блочные теги и br/img разделяют слова пробелом', () => {
    expect(countWords('<p>Привет</p><p>мир</p>')).toBe(2);
    expect(countWords('<p>Привет<br>мир<br/>снова</p>')).toBe(3);
    expect(countWords('<h1>Заголовок</h1><div>Текст</div>')).toBe(2);
    expect(countWords('<ul><li>Раз</li><li>Два</li></ul>')).toBe(2);
    expect(countWords('<table><tr><td>А</td><td>Б</td></tr></table>')).toBe(2);
    expect(countWords('<p>До<img src="x.png">после</p>')).toBe(2);
  });

  it('мягкие переносы и zero-width символы удаляются без разрыва слова', () => {
    expect(countWords('<p>при\u00ADвет</p>')).toBe(1);
    expect(countWords('<p>при&shy;вет при&#173;вет при&#xAD;вет</p>')).toBe(3);
    expect(countWords('<p>при\u200Bвет \uFEFFтекст при&#8203;мер</p>')).toBe(3);
  });

  it('апострофы и неразрывные дефисы (включая HTML-сущности) сохраняют целостность слова', () => {
    expect(countWords('<p>don&#39;t don&#x27;t don&apos;t</p>')).toBe(3);
    expect(countWords('<p>O&rsquo;Connor O&#8217;Brien д’Артаньян</p>')).toBe(3);
    expect(countWords('<p>как\u2011то как&#8209;то Ростов-на-Дону</p>')).toBe(3);
  });

  it('HTML-сущности не считаются словами', () => {
    expect(countWords('<p>Слово&nbsp;другое</p>')).toBe(2);
    expect(countWords('<p>&mdash; Да, &mdash; сказал он.</p>')).toBe(3);
    expect(countWords('<p>слово—слово</p>')).toBe(2);
    expect(countWords('<p>--- ... !!!</p>')).toBe(0);
    expect(countWords("<p>'привет' слово-</p>")).toBe(2);
  });

  it('style, script и HTML-комментарии полностью игнорируются', () => {
    expect(countWords('<style>body { color: red }</style>Текст')).toBe(1);
    expect(countWords('<script>const x = 1</script>Текст')).toBe(1);
    expect(countWords('<!-- скрытый комментарий -->Текст')).toBe(1);
  });

  it('дефисные слова считаются как одно слово', () => {
    expect(countWords('Ростов-на-Дону')).toBe(1);
  });

  it('комбинируемые диакритики (ударения, NFD ё/й) и акцентированные HTML-сущности не разрывают слово', () => {
    expect(countWords('<p>за\u0301мок и по-ру\u0301сски</p>')).toBe(3);
    expect(countWords('<p>е\u0308лка и вои\u0306на</p>')).toBe(3);
    expect(countWords('<p>\u0301 \u0308</p>')).toBe(0);
    expect(countWords('<p>r&eacute;sum&eacute; clich&eacute;s na&iuml;ve</p>')).toBe(3);
    expect(countWords('<p>при&ZeroWidthSpace;вет как&nbhy;то</p>')).toBe(2);
    expect(countWords('<p>сло\u200Cво\u200Dтест &#8204;раз&#x200D;два &zwnj;три&zwj;четыре</p>')).toBe(3);
  });

  it('только пробелы и теги → 0', () => {
    expect(countWords('<p>   </p>')).toBe(0);
  });
});

describe('countChars', () => {
  it('пустая строка → 0', () => {
    expect(countChars('')).toBe(0);
  });

  it('удаляет теги, style/script и комментарии', () => {
    expect(countChars('<p>Привет</p><p>мир</p>')).toBe(9);
    expect(countChars('<style>.a{color:red}</style><script>1+1</script><!-- x --><p>АБВ</p>')).toBe(3);
  });

  it('декодирует HTML-сущности в один символ, без двойного декодирования', () => {
    expect(countChars('<p>А&nbsp;&mdash;&nbsp;Б</p>')).toBe(5);
    expect(countChars('<p>&laquo;Да&raquo; &amp; &#39;нет&#39;</p>')).toBe(12);
    expect(countChars('<p>&amp;nbsp;</p>')).toBe(6);
  });

  it('игнорирует мягкие переносы и zero-width символы', () => {
    expect(countChars('<p>При\u00ADвет&shy;&#173;&#xAD;\u200B\u200C\u200D&#8204;&#x200D;&zwnj;&zwj;\uFEFF</p>')).toBe(6);
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
