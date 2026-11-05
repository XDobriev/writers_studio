// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BookExportPreview, type BookExportPreviewProps } from './BookExportPreview';
import type { Book } from '../lib/supabase';
import type { ChapterMeta } from '../lib/chapters';
import type { Character } from '../lib/characters';
import type { Location } from '../lib/locations';

vi.mock('../lib/queries', () => ({
  useChapterContent: (chapterId: string | undefined) => {
    if (chapterId === 'ch-1') {
      return { data: { id: 'ch-1', content: '<p>Текст первой главы книги.</p>' }, isLoading: false };
    }
    return { data: undefined, isLoading: false };
  },
}));

let root: Root | null = null;

const dummyBook: Book = {
  id: 'b-1',
  user_id: 'u-1',
  title: 'Хроники Забытого Города',
  author: 'Анна Ахматова',
  genre: 'Фэнтези',
  genres: ['Фэнтези', 'Приключения'],
  cover: 'https://example.com/cover.jpg',
  map_bg_url: 'https://example.com/map.jpg',
  series_id: 's-1',
  series_order: 2,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
} as Book;

const dummyChapters: ChapterMeta[] = [
  { id: 'ch-1', book_id: 'b-1', user_id: 'u-1', title: 'Глава 1. Пробуждение', position: 1, words: 1500, status: 'done', synopsis: '', created_at: '2026-01-01', updated_at: '2026-01-01' },
  { id: 'ch-2', book_id: 'b-1', user_id: 'u-1', title: 'Глава 2. Тени прошлого', position: 2, words: 2200, status: 'done', synopsis: '', created_at: '2026-01-02', updated_at: '2026-01-02' },
];

const dummyCharacters: Character[] = [
  {
    id: 'char-1',
    book_id: 'b-1',
    user_id: 'u-1',
    name: 'Элиан Ветрокрыл',
    role: 'protagonist',
    age: 24,
    quote: 'Ветер знает ответы на все вопросы.',
    appearance: 'Высокий юноша с серебряными волосами.',
    personality: 'Спокойный, рассудительный.',
    interior_life: '',
    exterior_life: '',
    gap: '',
    backstory: '',
    notes: '',
    aliases: ['Ветрокрыл', 'Странник'],
    avatar_url: null,
    position: 0,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
];

const dummyLocations: Location[] = [
  {
    id: 'loc-1',
    book_id: 'b-1',
    user_id: 'u-1',
    name: 'Цитадель Рассвета',
    type: 'castle',
    role: 'Столица северных земель',
    description: 'Древняя каменная крепость на вершине утёса.',
    size: 1,
    x: 100,
    y: 200,
    position: 0,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
];

function mount(props?: Partial<BookExportPreviewProps>): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  const defaultProps: BookExportPreviewProps = {
    book: dummyBook,
    authorName: 'Анна Ахматова',
    format: 'epub',
    paragraphStyle: 'indent',
    pdfPageSize: 'a5',
    selectedChapters: dummyChapters,
    includeTitlePage: true,
    includeChapterTitles: true,
    includeCharacters: true,
    includeLocations: true,
    includeMap: true,
    characters: dummyCharacters,
    locations: dummyLocations,
    hasMapContent: true,
    series: { name: 'Хроники Севера', number: 2 },
    ...props,
  };
  act(() => {
    root!.render(createElement(BookExportPreview, defaultProps));
  });
  return el;
}

afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('BookExportPreview', () => {
  it('рендерит титульный лист книги с названием, автором и серией', () => {
    const el = mount();

    expect(el.querySelector('[data-testid="preview-page-title"]')).not.toBeNull();
    expect(el.textContent).toContain('Хроники Забытого Города');
    expect(el.textContent).toContain('Анна Ахматова');
    expect(el.textContent).toContain('Серия «Хроники Севера» · Книга 2');
    expect(el.textContent).toContain('Фэнтези, Приключения');

    // Проверяем наличие всех вкладок страниц
    const tabs = el.querySelectorAll('.book-preview-tab');
    const tabTexts = Array.from(tabs).map((t) => t.textContent?.trim());
    expect(tabTexts).toEqual(['Титул', 'Оглавление', 'Глава', 'Персонажи', 'Локации', 'Карта']);
  });

  it('динамически обновляет имя автора на титульном листе при изменении', () => {
    const el = mount({ authorName: 'Михаил Булгаков' });
    expect(el.textContent).toContain('Михаил Булгаков');
  });

  it('переключается на Оглавление и позволяет кликнуть по главе', () => {
    const el = mount();

    // Кликаем по вкладке "Оглавление"
    const tocTab = Array.from(el.querySelectorAll('.book-preview-tab')).find(
      (t) => t.textContent?.trim() === 'Оглавление',
    );
    expect(tocTab).toBeDefined();
    act(() => {
      (tocTab as HTMLButtonElement).click();
    });

    expect(el.querySelector('[data-testid="preview-page-toc"]')).not.toBeNull();
    expect(el.textContent).toContain('Глава 1. Пробуждение');
    expect(el.textContent).toContain('Глава 2. Тени прошлого');
    expect(el.textContent).toContain('Приложение: Действующие лица');
    expect(el.textContent).toContain('Приложение: География и локации');
    expect(el.textContent).toContain('Приложение: Карта мира');

    // Кликаем по второй главе в оглавлении
    const rows = el.querySelectorAll('.book-preview-toc-row');
    act(() => {
      (rows[1] as HTMLButtonElement).click();
    });

    // Должно переключиться на страницу главы
    expect(el.querySelector('[data-testid="preview-page-chapter"]')).not.toBeNull();
    expect(el.textContent).toContain('Глава 2. Тени прошлого');
    expect(el.textContent).toContain('Глава 2 из 2');
  });

  it('динамически реагирует на выключение титульного листа и оглавления', () => {
    const el = mount({ includeTitlePage: false });

    // Вкладки "Титул" и "Оглавление" должны исчезнуть
    const tabs = el.querySelectorAll('.book-preview-tab');
    const tabTexts = Array.from(tabs).map((t) => t.textContent?.trim());
    expect(tabTexts).not.toContain('Титул');
    expect(tabTexts).not.toContain('Оглавление');

    // Автоматически активируется "Глава"
    expect(el.querySelector('[data-testid="preview-page-chapter"]')).not.toBeNull();
  });

  it('динамически реагирует на тумблеры персонажей, локаций и карты', () => {
    const el = mount({
      includeCharacters: false,
      includeLocations: false,
      includeMap: false,
    });

    const tabs = el.querySelectorAll('.book-preview-tab');
    const tabTexts = Array.from(tabs).map((t) => t.textContent?.trim());
    expect(tabTexts).not.toContain('Персонажи');
    expect(tabTexts).not.toContain('Локации');
    expect(tabTexts).not.toContain('Карта');
  });

  it('отображает страницу действующих лиц со всеми деталями персонажа', () => {
    const el = mount();

    const charTab = Array.from(el.querySelectorAll('.book-preview-tab')).find(
      (t) => t.textContent?.trim() === 'Персонажи',
    );
    expect(charTab).toBeDefined();
    act(() => {
      (charTab as HTMLButtonElement).click();
    });

    expect(el.querySelector('[data-testid="preview-page-characters"]')).not.toBeNull();
    expect(el.textContent).toContain('Элиан Ветрокрыл');
    expect(el.textContent).toContain('Главный герой');
    expect(el.textContent).toContain('Ветрокрыл, Странник');
    expect(el.textContent).toContain('Высокий юноша с серебряными волосами.');
  });

  it('отображает страницу локаций', () => {
    const el = mount();

    const locTab = Array.from(el.querySelectorAll('.book-preview-tab')).find(
      (t) => t.textContent?.trim() === 'Локации',
    );
    expect(locTab).toBeDefined();
    act(() => {
      (locTab as HTMLButtonElement).click();
    });

    expect(el.querySelector('[data-testid="preview-page-locations"]')).not.toBeNull();
    expect(el.textContent).toContain('Цитадель Рассвета');
    expect(el.textContent).toContain('Древняя каменная крепость на вершине утёса.');
  });

  it('отображает карту книги', () => {
    const el = mount();

    const mapTab = Array.from(el.querySelectorAll('.book-preview-tab')).find(
      (t) => t.textContent?.trim() === 'Карта',
    );
    expect(mapTab).toBeDefined();
    act(() => {
      (mapTab as HTMLButtonElement).click();
    });

    expect(el.querySelector('[data-testid="preview-page-map"]')).not.toBeNull();
    const img = el.querySelector('.book-preview-map-img') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toBe('https://example.com/map.jpg');
  });

  it('корректно отображает служебные главы (Пролог) вне сквозной нумерации в оглавлении и навигации', () => {
    const chaptersWithPrologue: ChapterMeta[] = [
      { id: 'ch-prologue', book_id: 'b-1', user_id: 'u-1', title: 'Пролог', position: 0, words: 500, status: 'done', synopsis: '', created_at: '2026-01-01', updated_at: '2026-01-01' },
      { id: 'ch-1', book_id: 'b-1', user_id: 'u-1', title: 'Глава 1. Пробуждение', position: 1, words: 1500, status: 'done', synopsis: '', created_at: '2026-01-02', updated_at: '2026-01-02' },
      { id: 'ch-epilogue', book_id: 'b-1', user_id: 'u-1', title: 'Эпилог', position: 2, words: 600, status: 'done', synopsis: '', created_at: '2026-01-03', updated_at: '2026-01-03' },
    ];

    const el = mount({ selectedChapters: chaptersWithPrologue });

    // Переходим в Оглавление
    const tocTab = Array.from(el.querySelectorAll('.book-preview-tab')).find(
      (t) => t.textContent?.trim() === 'Оглавление',
    );
    expect(tocTab).toBeDefined();
    act(() => {
      (tocTab as HTMLButtonElement).click();
    });

    const rows = el.querySelectorAll('.book-preview-toc-row');
    expect(rows.length).toBeGreaterThanOrEqual(3);

    // У Пролога номер в оглавлении должен быть тире «—»
    const num0 = rows[0].querySelector('.book-preview-toc-num')?.textContent?.trim();
    expect(num0).toBe('—');
    expect(rows[0].querySelector('.book-preview-toc-name')?.textContent).toBe('Пролог');

    // У Главы 1 номер должен быть «1.»
    const num1 = rows[1].querySelector('.book-preview-toc-num')?.textContent?.trim();
    expect(num1).toBe('1.');
    expect(rows[1].querySelector('.book-preview-toc-name')?.textContent).toBe('Глава 1. Пробуждение');

    // У Эпилога номер в оглавлении также «—»
    const num2 = rows[2].querySelector('.book-preview-toc-num')?.textContent?.trim();
    expect(num2).toBe('—');
    expect(rows[2].querySelector('.book-preview-toc-name')?.textContent).toBe('Эпилог');

    // Кликаем на Пролог -> попадаем в просмотр главы
    act(() => {
      (rows[0] as HTMLButtonElement).click();
    });
    expect(el.querySelector('.book-preview-chapter-counter')?.textContent).toBe('ПРОЛОГ · 1 из 3');

    // Переходим к следующей главе (Глава 1)
    const nextBtn = el.querySelector('.book-preview-nav-btn[aria-label="Следующая глава"]') as HTMLButtonElement;
    act(() => {
      nextBtn.click();
    });
    // Следующая глава должна оставаться полноценной «Главой 1»
    expect(el.querySelector('.book-preview-chapter-counter')?.textContent).toBe('Глава 1 из 3');
  });

  it('применяет класс стиля абзацев и скрывает заголовки глав при includeChapterTitles: false', () => {
    const el = mount({
      includeTitlePage: false,
      includeChapterTitles: false,
      paragraphStyle: 'spacing',
    });

    expect(el.querySelector('.book-preview-chapter-title')).toBeNull();
    expect(el.querySelector('.preview-p--spacing')).not.toBeNull();
  });
});
