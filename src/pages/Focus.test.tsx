// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QUERY_KEYS } from '../lib/queries';
import type { Book } from '../lib/supabase';
import type { ChapterMeta } from '../lib/chapters';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));
vi.mock('../lib/auth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../lib/useUserDisplay', () => ({ useUserDisplay: () => ({ plan: 'pro' }) }));
vi.mock('../components/RichEditor', () => ({
  RichEditor: () => <div data-testid="mock-rich-editor" />,
}));
vi.mock('../components/AmbientSoundControl', () => ({
  AmbientSoundControl: () => null,
}));
vi.mock('../lib/useChapterVersioning', () => ({
  useChapterVersioning: () => ({ onContentTracked: vi.fn() }),
}));
vi.mock('../lib/useChapterAutosave', () => ({
  useChapterAutosave: () => ({
    scheduleContent: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
    saveState: 'idle',
    notice: null,
    clearNotice: vi.fn(),
  }),
  useRecoveredChapterContent: () => ({ content: '<p>Привет мир</p>', ready: true }),
}));

import Focus from './Focus';

const baseBook = (goal: number): Book => ({
  id: 'b1',
  user_id: 'u1',
  title: 'Роман',
  author: null,
  genre: null,
  genres: [],
  cover: null,
  goal,
  daily_goal: 1000,
  words: 999, // намеренно устаревший кэш book.words — UI должен брать живую сумму глав
  imported_words: 0,
  share_token: null,
  map_bg_url: null,
  map_template: null,
  series_id: null,
  series_order: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

const chapters: ChapterMeta[] = [
  {
    id: 'c1',
    book_id: 'b1',
    user_id: 'u1',
    title: 'Глава 1',
    position: 0,
    synopsis: '',
    words: 120,
    status: 'draft',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'c2',
    book_id: 'b1',
    user_id: 'u1',
    title: 'Глава 2',
    position: 1,
    synopsis: '',
    words: 380,
    status: 'draft',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) act(() => root!.unmount());
  container?.remove();
  root = null;
  container = null;
});

function renderFocus(goal: number) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(QUERY_KEYS.book('b1'), baseBook(goal));
  qc.setQueryData(QUERY_KEYS.chapters('b1'), chapters);
  qc.setQueryData(QUERY_KEYS.chapterContent('c1'), { id: 'c1', content: '<p>Привет мир</p>' });

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/books/b1/focus?chapter=c1']}>
          <Routes>
            <Route path="/books/:id/focus" element={<Focus />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  return container;
}

describe('Focus word count footer', () => {
  it('с заданной целью показывает слова текущей главы «в главе» и живую сумму глав в прогрессе книги', () => {
    const el = renderFocus(2000);
    const foot = el.querySelector('.focus-foot')?.textContent ?? '';
    expect(foot).toContain('120 слов в главе');
    expect(foot).toContain('500/2');
    expect(foot).not.toContain('999');
  });

  it('без цели показывает живую сумму слов всех глав «в книге»', () => {
    const el = renderFocus(0);
    const foot = el.querySelector('.focus-foot')?.textContent ?? '';
    expect(foot).toContain('500 слов в книге');
    expect(foot).not.toContain('999');
  });
});
