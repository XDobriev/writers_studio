// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QUERY_KEYS } from '../lib/queries';
import type { ChapterMeta } from '../lib/chapters';
import type { ChapterVersionMeta } from '../lib/versions';

const getVersionContentMock = vi.fn<(id: string) => Promise<string>>();
const createVersionMock = vi.fn();
const updateChapterMock = vi.fn();

vi.mock('../lib/versions', () => ({
  getVersionContent: (id: string) => getVersionContentMock(id),
  createVersion: (...args: unknown[]) => createVersionMock(...args),
}));

vi.mock('../lib/chapters', async (orig) => ({
  ...(await orig<typeof import('../lib/chapters')>()),
  updateChapter: (...args: unknown[]) => updateChapterMock(...args),
}));

vi.mock('./ConfirmDialog', () => ({
  ConfirmDialog: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? <button data-testid="confirm-restore" onClick={onConfirm}>Подтвердить</button> : null,
}));

import { VersionModal } from './VersionModal';

const version = (id: string, wordCount: number): ChapterVersionMeta => ({
  id,
  chapter_id: 'c1',
  user_id: 'u1',
  word_count: wordCount,
  label: `Версия ${id}`,
  trigger: 'manual',
  created_at: '2026-06-15T10:00:00Z',
});

const chapterMeta: ChapterMeta = {
  id: 'c1',
  book_id: 'b1',
  user_id: 'u1',
  title: 'Глава 1',
  position: 0,
  synopsis: '',
  words: 10,
  status: 'draft',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-06-15T09:00:00Z',
};

describe('VersionModal restore', () => {
  let root: Root;
  let container: HTMLDivElement;
  let qc: QueryClient;

  beforeEach(() => {
    getVersionContentMock.mockReset();
    createVersionMock.mockReset().mockResolvedValue(undefined);
    updateChapterMock.mockReset();
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(QUERY_KEYS.chapters('b1'), [chapterMeta]);
    qc.setQueryData(QUERY_KEYS.chapterContent('c1'), { id: 'c1', content: '<p>Текущий текст главы</p>' });
    qc.setQueryData(QUERY_KEYS.book('b1'), { id: 'b1', words: 10 });
    qc.setQueryData(QUERY_KEYS.books('u1'), [{ id: 'b1', words: 10 }]);
    qc.setQueryData(QUERY_KEYS.writingSnapshots('b1'), []);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    qc.clear();
  });

  it('откат версии вызывает onBeforeRestore, onRebase(id, updatedAt, words) и синхронизирует кэши без повторной блокировки кнопки', async () => {
    const onBeforeRestore = vi.fn().mockResolvedValue(undefined);
    const onRebase = vi.fn();
    const onClose = vi.fn();
    const onRestored = vi.fn();

    getVersionContentMock
      .mockResolvedValueOnce('<p>Один два три четыре пять</p>')
      .mockResolvedValueOnce('<p>Один два</p>');
    updateChapterMock
      .mockResolvedValueOnce({ ...chapterMeta, content: '<p>Один два три четыре пять</p>', words: 5, updated_at: '2026-06-15T11:00:00Z' })
      .mockResolvedValueOnce({ ...chapterMeta, content: '<p>Один два</p>', words: 2, updated_at: '2026-06-15T12:00:00Z' });

    const renderWith = (open: boolean, v: ChapterVersionMeta | null) => {
      act(() => {
        root.render(
          <QueryClientProvider client={qc}>
            <VersionModal
              open={open}
              version={v}
              chapterId="c1"
              bookId="b1"
              userId="u1"
              currentContent="<p>Текущий текст главы</p>"
              onBeforeRestore={onBeforeRestore}
              onRebase={onRebase}
              onClose={onClose}
              onRestored={onRestored}
            />
          </QueryClientProvider>,
        );
      });
    };

    renderWith(true, version('v1', 5));
    await act(async () => { await Promise.resolve(); });

    const restoreBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Восстановить') as HTMLButtonElement;
    expect(restoreBtn).toBeDefined();
    expect(restoreBtn.disabled).toBe(false);

    act(() => { restoreBtn.click(); });
    const confirmBtn = container.querySelector('[data-testid="confirm-restore"]') as HTMLButtonElement;
    await act(async () => { confirmBtn.click(); await Promise.resolve(); });

    expect(onBeforeRestore).toHaveBeenCalledTimes(1);
    expect(createVersionMock).toHaveBeenCalledWith('c1', 'u1', '<p>Текущий текст главы</p>', 3, 'manual');
    expect(updateChapterMock).toHaveBeenCalledWith('c1', { content: '<p>Один два три четыре пять</p>', words: 5 });
    expect(onRebase).toHaveBeenCalledWith('c1', '2026-06-15T11:00:00Z', 5);
    expect(onRestored).toHaveBeenCalledWith('<p>Один два три четыре пять</p>');
    expect(qc.getQueryData(QUERY_KEYS.chapterContent('c1'))).toEqual({ id: 'c1', content: '<p>Один два три четыре пять</p>' });
    expect(qc.getQueryData<ChapterMeta[]>(QUERY_KEYS.chapters('b1'))?.[0].words).toBe(5);
    expect(qc.getQueryState(QUERY_KEYS.book('b1'))?.isInvalidated).toBe(true);
    expect(qc.getQueryState(QUERY_KEYS.books('u1'))?.isInvalidated).toBe(true);
    expect(qc.getQueryState(QUERY_KEYS.writingSnapshots('b1'))?.isInvalidated).toBe(true);

    // Повторное открытие модалки (смонтирована постоянно в VersionsPanel) — кнопка не должна залипать в disabled
    renderWith(false, null);
    renderWith(true, version('v2', 2));
    await act(async () => { await Promise.resolve(); });

    const restoreBtn2 = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Восстановить') as HTMLButtonElement;
    expect(restoreBtn2.disabled).toBe(false);

    act(() => { restoreBtn2.click(); });
    const confirmBtn2 = container.querySelector('[data-testid="confirm-restore"]') as HTMLButtonElement;
    await act(async () => { confirmBtn2.click(); await Promise.resolve(); });

    expect(onRebase).toHaveBeenLastCalledWith('c1', '2026-06-15T12:00:00Z', 2);
  });
});
