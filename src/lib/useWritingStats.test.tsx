// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toLocalISODate } from './dates';
import type { WritingSnapshot } from './books';

const listWritingSnapshots = vi.fn<(bookId: string, fromDate: string) => Promise<WritingSnapshot[]>>();

vi.mock('./supabase', () => ({ supabase: {} }));
vi.mock('./books', async (orig) => ({
  ...(await orig<typeof import('./books')>()),
  listWritingSnapshots: (bookId: string, fromDate: string) => listWritingSnapshots(bookId, fromDate),
}));

import { useWritingStats } from './useWritingStats';
import { QUERY_KEYS } from './queries';

describe('useWritingStats', () => {
  let root: Root;
  let container: HTMLDivElement;
  let qc: QueryClient;
  let latest: ReturnType<typeof useWritingStats>;

  function Harness({ bookId, startWords = 0 }: { bookId?: string; startWords?: number }) {
    latest = useWritingStats(bookId, startWords);
    return null;
  }

  beforeEach(() => {
    listWritingSnapshots.mockReset();
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    qc.clear();
  });

  it('использует единое 366-дневное окно writingSnapshots и считает серию > 31 дня', async () => {
    const today = new Date();
    const snapshots: WritingSnapshot[] = Array.from({ length: 40 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (39 - i));
      return { date: toLocalISODate(d), words: (i + 1) * 50, written_words: 50 };
    });
    listWritingSnapshots.mockResolvedValueOnce(snapshots);

    act(() => {
      root.render(createElement(QueryClientProvider, { client: qc }, createElement(Harness, { bookId: 'b1' })));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(latest.isLoading).toBe(false);
    expect(listWritingSnapshots).toHaveBeenCalledTimes(1);
    expect(latest.streak).toBe(40);
    expect(latest.todayWords).toBe(50);
  });

  it('учитывает written_words=0 от триггеров без ложной legacy-дельты и поддерживает refetch через writingSnapshots', async () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    listWritingSnapshots
      .mockResolvedValueOnce([
        { date: toLocalISODate(yesterday), words: 1000, written_words: null },
        { date: toLocalISODate(today), words: 1400, written_words: 0 },
      ])
      .mockResolvedValueOnce([
        { date: toLocalISODate(yesterday), words: 1000, written_words: null },
        { date: toLocalISODate(today), words: 1400, written_words: 35 },
      ]);

    act(() => {
      root.render(createElement(QueryClientProvider, { client: qc }, createElement(Harness, { bookId: 'b2' })));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(latest.isLoading).toBe(false);
    expect(latest.streak).toBe(1);
    expect(latest.todayWords).toBe(0);
    expect(qc.getQueryData(QUERY_KEYS.writingSnapshots('b2'))).toBeDefined();

    act(() => {
      latest.refetch();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(latest.todayWords).toBe(35);
    expect(latest.streak).toBe(2);
  });

  it('при переходе через локальную полночь сбрасывает todayWords в 0 без перезагрузки и смены ссылки data', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 5, 15, 23, 59, 50));
      const day1 = toLocalISODate(new Date(2026, 5, 15));
      listWritingSnapshots.mockResolvedValue([
        { date: day1, words: 250, written_words: 250 },
      ]);

      act(() => {
        root.render(createElement(QueryClientProvider, { client: qc }, createElement(Harness, { bookId: 'b3' })));
      });
      await act(async () => { await vi.advanceTimersByTimeAsync(10); });

      expect(latest.todayWords).toBe(250);
      expect(latest.streak).toBe(1);

      // Наступает следующий день; данные сервера не менялись (тот же массив)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000);
      });

      expect(latest.todayWords).toBe(0);
      // Вчерашний день сохраняет серию 1
      expect(latest.streak).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
