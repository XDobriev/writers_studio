// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Export from './Export';
import type { Book } from '../lib/supabase';
import type { Profile } from '../lib/profiles';

let mockProfile: Profile | null = null;

const dummyBook: Book = {
  id: 'book-123',
  user_id: 'user-1',
  title: 'Повелитель Ветра',
  author: 'Лев Толстой',
  genre: 'Роман',
  genres: ['Роман', 'Классика'],
  cover: 'https://example.com/cover.jpg',
  map_bg_url: null,
  series_id: null,
  series_order: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
} as Book;

const dummyChapters = [
  { id: 'ch-1', book_id: 'book-123', title: 'Глава 1', position: 1, words: 1200, status: 'done', pov_character_id: null, created_at: '2026-01-01' },
];

vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', user_metadata: { full_name: 'Лев Толстой' } },
  }),
}));

vi.mock('../lib/queries', () => ({
  useProfile: () => ({ data: mockProfile }),
  useBook: () => ({ data: dummyBook }),
  useChapters: () => ({ data: dummyChapters }),
  useCharacters: () => ({ data: [] }),
  useNotes: () => ({ data: [] }),
  useLocations: () => ({ data: [] }),
  useConnections: () => ({ data: [] }),
  useStamps: () => ({ data: [] }),
  useBookContentCounts: () => ({ data: { characters: 0, locations: 0, notes: 0 } }),
  useSeries: () => ({ data: [] }),
  useChapterContent: () => ({ data: undefined, isLoading: false }),
  QUERY_KEYS: {
    profile: (id: string) => ['profile', id],
    book: (id: string) => ['book', id],
    books: (id: string) => ['books', id],
  },
}));

vi.mock('../lib/export', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/export')>();
  return {
    ...actual,
    triggerDownload: vi.fn(),
    downloadText: vi.fn(),
  };
});

let root: Root | null = null;
let queryClient: QueryClient;

function mount(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  act(() => {
    root!.render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          MemoryRouter,
          { initialEntries: ['/books/book-123/export'] },
          createElement(
            Routes,
            null,
            createElement(Route, { path: '/books/:id/export', element: createElement(Export) }),
          ),
        ),
      ),
    );
  });
  return el;
}

beforeEach(() => {
  mockProfile = {
    id: 'user-1',
    plan: 'free',
    plan_expires_at: null,
    role: 'author',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  } as unknown as Profile;
});

afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('Export page (G-9: интерактивный предпросмотр и пейволл)', () => {
  it('на тарифе Free позволяет свободно переключаться между Pro-форматами без мгновенного пейволла', () => {
    const el = mount();

    // По умолчанию выбран EPUB
    expect(el.textContent).toContain('Скачать (Pro)');

    // Ищем карточку FB2 и кликаем по ней
    const fb2Btn = Array.from(el.querySelectorAll('.export-fmt-grid .export-fmt-card')).find(
      (btn) => btn.textContent?.includes('FB2'),
    );
    expect(fb2Btn).toBeDefined();

    // Клик НЕ должен открывать UpgradePrompt
    act(() => {
      (fb2Btn as HTMLButtonElement).click();
    });

    // Модалка апгрейда НЕ открыта
    expect(document.querySelector('[role="dialog"][aria-label="Экспорт недоступен"]')).toBeNull();
    // FB2 стал выбран
    expect(fb2Btn?.getAttribute('aria-pressed')).toBe('true');
  });

  it('на тарифе Free показывает аккуратный бейдж Pro на Pro-форматах', () => {
    const el = mount();

    // Карточки форматов .EPUB, .FB2, .DOCX, .PDF
    const formatCards = el.querySelectorAll('.export-fmt-grid .export-fmt-card');
    expect(formatCards.length).toBe(4);

    formatCards.forEach((card) => {
      expect(card.querySelector('.chip--accent')?.textContent).toContain('Pro');
    });

    // Текстовые форматы (HTML, TXT, MD) не имеют Pro-бейджа
    const textBtns = el.querySelectorAll('.export-fmt-btn');
    textBtns.forEach((btn) => {
      expect(btn.querySelector('.chip--accent')).toBeNull();
    });
  });

  it('на тарифе Free кнопка скачивания Pro-формата имеет текст «Скачать (Pro)» и открывает UpgradePrompt при нажатии', () => {
    const el = mount();

    const downloadBtn = el.querySelector('.export-footer-actions .btn--primary') as HTMLButtonElement;
    expect(downloadBtn).not.toBeNull();
    expect(downloadBtn.textContent).toContain('Скачать (Pro)');

    // Нажимаем на кнопку скачивания
    act(() => {
      downloadBtn.click();
    });

    // Теперь пейволл открылся
    expect(document.querySelector('[role="dialog"][aria-label="Экспорт недоступен"]')).not.toBeNull();
  });

  it('при выборе бесплатного формата (HTML) кнопка скачивания доступна бесплатно', () => {
    const el = mount();

    const htmlBtn = Array.from(el.querySelectorAll('.export-fmt-btn')).find(
      (btn) => btn.textContent?.trim() === 'HTML',
    );
    expect(htmlBtn).toBeDefined();

    act(() => {
      (htmlBtn as HTMLButtonElement).click();
    });

    const downloadBtn = el.querySelector('.export-footer-actions .btn--primary') as HTMLButtonElement;
    expect(downloadBtn.textContent).toContain('Скачать HTML');
    expect(downloadBtn.textContent).not.toContain('(Pro)');
  });

  it('на тарифе Pro Pro-форматы не имеют замков и скачиваются напрямую', () => {
    mockProfile = {
      id: 'user-1',
      plan: 'pro',
      plan_expires_at: null,
      role: 'author',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    } as unknown as Profile;

    const el = mount();

    // Карточки форматов не имеют бейджа Pro
    const formatCards = el.querySelectorAll('.export-fmt-grid .export-fmt-card');
    formatCards.forEach((card) => {
      expect(card.querySelector('.chip--accent')).toBeNull();
    });

    // Кнопка скачивания не имеет пометки (Pro)
    const downloadBtn = el.querySelector('.export-footer-actions .btn--primary') as HTMLButtonElement;
    expect(downloadBtn.textContent).toContain('Скачать EPUB');
    expect(downloadBtn.textContent).not.toContain('(Pro)');
  });

  it('рендерит блок интерактивного предпросмотра книги и реагирует на мобильный переключатель видов', () => {
    const el = mount();

    // Предпросмотр встроен на странице
    expect(el.querySelector('[data-testid="book-export-preview"]')).not.toBeNull();

    // Переключатель вида на мобильных
    const viewTabs = el.querySelectorAll('.export-view-tab');
    expect(viewTabs.length).toBe(2);

    const layout = el.querySelector('.export-layout');
    expect(layout?.getAttribute('data-view')).toBe('settings');

    // Кликаем по вкладке "Предпросмотр"
    act(() => {
      (viewTabs[1] as HTMLButtonElement).click();
    });

    expect(layout?.getAttribute('data-view')).toBe('preview');
  });
});
