// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SeriesTransferPicker, INITIAL_SERIES_TRANSFER } from './SeriesTransferPicker';
import type { Book } from '../lib/supabase';

let root: Root | null = null;
let queryClient: QueryClient;

const MOCK_BOOK: Book = {
  id: 'b-1',
  user_id: 'u-1',
  title: 'Книга 1',
  author: null,
  genre: null,
  genres: [],
  goal: 50000,
  words: 10000,
  cover: null,
  daily_goal: 0,
  imported_words: 0,
  map_bg_url: null,
  map_template: null,
  series_id: null,
  series_order: null,
  share_token: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function mount(props = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  act(() => {
    root!.render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(SeriesTransferPicker, {
          books: [MOCK_BOOK],
          value: { ...INITIAL_SERIES_TRANSFER, enabled: true, sourceBookId: 'b-1' },
          onChange: vi.fn(),
          ...props,
        }),
      ),
    );
  });
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('SeriesTransferPicker', () => {
  it('использует класс .as-checkbox для всех чекбоксов', () => {
    const container = mount();
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBeGreaterThan(0);

    checkboxes.forEach((cb) => {
      expect(cb.classList.contains('as-checkbox')).toBe(true);
    });
  });
});
