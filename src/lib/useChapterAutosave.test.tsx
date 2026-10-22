// @vitest-environment jsdom
// React 18: поддержка act() вне testing-library.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ChapterMeta, ChapterPatch } from './chapters';

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: 't' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

const updateChapterMeta = vi.fn<(id: string, patch: ChapterPatch, expected?: string | null) => Promise<ChapterMeta | null>>();
const getChapterState = vi.fn<(id: string) => Promise<{ content: string; updated_at: string } | null>>();
vi.mock('./chapters', async (orig) => ({
  ...(await orig<typeof import('./chapters')>()),
  updateChapterMeta: (id: string, patch: ChapterPatch, expected?: string | null) => updateChapterMeta(id, patch, expected),
  getChapterState: (id: string) => getChapterState(id),
}));
const createVersion = vi.fn((..._args: unknown[]) => Promise.resolve());
vi.mock('./versions', () => ({ createVersion: (...a: unknown[]) => createVersion(...a) }));
vi.mock('./crossrefs', () => ({
  listMatchableCharacters: () => Promise.resolve([]),
  syncBacklinks: () => Promise.resolve(),
}));

import { useChapterAutosave, type ChapterAutosave } from './useChapterAutosave';
import { decideDraft, readDraft, writeDraft } from './chapterDrafts';
import { QUERY_KEYS } from './queries';

const meta = (id: string, updated_at: string, extra: Partial<ChapterMeta> = {}): ChapterMeta => ({
  id, book_id: 'b1', user_id: 'u1', title: 'Глава', position: 0, synopsis: '',
  words: 0, status: 'draft', created_at: '2026-01-01T00:00:00Z', updated_at, ...extra,
});

let root: Root;
let container: HTMLDivElement;
let api: ChapterAutosave;
let qc: QueryClient;

function Harness() {
  api = useChapterAutosave({ bookId: 'b1', userId: 'u1', isPro: true });
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  updateChapterMeta.mockReset();
  getChapterState.mockReset();
  createVersion.mockClear();
  qc = new QueryClient();
  qc.setQueryData(QUERY_KEYS.chapters('b1'), [meta('c1', 'v1'), meta('c2', 'w1')]);
  container = document.createElement('div');
  root = createRoot(container);
  act(() => { root.render(createElement(QueryClientProvider, { client: qc }, createElement(Harness))); });
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

describe('decideDraft', () => {
  it('нет черновика или совпадает с сервером → none', () => {
    expect(decideDraft(null, 'a', 'v1').kind).toBe('none');
    expect(decideDraft({ content: 'a', base: 'v1', savedAt: 1 }, 'a', 'v2').kind).toBe('none');
  });
  it('база совпадает → restore, иначе → conflict', () => {
    expect(decideDraft({ content: 'b', base: 'v1', savedAt: 1 }, 'a', 'v1').kind).toBe('restore');
    expect(decideDraft({ content: 'b', base: 'v1', savedAt: 1 }, 'a', 'v2').kind).toBe('conflict');
    expect(decideDraft({ content: 'b', base: null, savedAt: 1 }, 'a', 'v1').kind).toBe('conflict');
  });
});

describe('useChapterAutosave', () => {
  it('патч старой главы не теряется при переходе в другую', async () => {
    let failC1 = true;
    updateChapterMeta.mockImplementation(async (id) => {
      if (id === 'c1' && failC1) throw new Error('offline');
      return meta(id, id === 'c1' ? 'v2' : 'w2');
    });
    act(() => api.scheduleContent('c1', '<p>A</p>'));
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(api.saveState).toBe('error');
    act(() => api.scheduleContent('c2', '<p>B</p>'));
    failC1 = false;
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    const sent = updateChapterMeta.mock.calls.map(([id, p]) => `${id}:${p.content}`);
    expect(sent).toContain('c1:<p>A</p>');
    expect(sent).toContain('c2:<p>B</p>');
    expect(readDraft('c1')).toBeNull();
    expect(api.saveState).toBe('saved');
  });

  it('один запрос в полёте: следующий уходит только после ответа', async () => {
    let release!: () => void;
    let inFlight = 0;
    let maxInFlight = 0;
    updateChapterMeta.mockImplementation(async (id) => {
      inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise<void>((r) => { release = r; });
      inFlight--;
      return meta(id, 'v' + Math.random());
    });
    act(() => api.scheduleContent('c1', '<p>1</p>'));
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    act(() => api.scheduleContent('c1', '<p>12</p>'));
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(updateChapterMeta).toHaveBeenCalledTimes(1);
    await act(async () => { release(); await vi.advanceTimersByTimeAsync(10); });
    await act(async () => { release(); await vi.advanceTimersByTimeAsync(10); });
    expect(maxInFlight).toBe(1);
    expect(updateChapterMeta.mock.calls.at(-1)?.[1].content).toBe('<p>12</p>');
  });

  it('ответ сервера не откатывает заголовок, набранный после отправки', async () => {
    let release!: () => void;
    updateChapterMeta.mockImplementationOnce(async (id, patch) => {
      await new Promise<void>((r) => { release = r; });
      return meta(id, 'v2', { title: patch.title ?? 'Глава' });
    }).mockImplementation(async (id, patch) => meta(id, 'v3', { title: patch.title ?? 'Глава' }));
    act(() => api.schedule('c1', { title: 'Гла' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    act(() => api.schedule('c1', { title: 'Глава один' }));
    await act(async () => { release(); await vi.advanceTimersByTimeAsync(10); });
    const title = qc.getQueryData<ChapterMeta[]>(QUERY_KEYS.chapters('b1'))?.find((c) => c.id === 'c1')?.title;
    expect(title).toBe('Глава один');
  });

  it('конфликт: серверная версия уходит в историю, затем пишется наш текст', async () => {
    updateChapterMeta
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(meta('c1', 'v9'));
    getChapterState.mockResolvedValue({ content: '<p>с телефона</p>', updated_at: 'v5' });
    act(() => api.scheduleContent('c1', '<p>с ноутбука</p>'));
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(updateChapterMeta.mock.calls[0][2]).toBe('v1');
    expect(createVersion).toHaveBeenCalledTimes(1);
    expect(createVersion.mock.calls[0][2]).toBe('<p>с телефона</p>');
    expect(updateChapterMeta.mock.calls[1][2]).toBeUndefined();
    expect(api.notice).toMatch(/другом окне/);
  });

  it('пока сервер не подтвердил — текст лежит в локальном черновике', async () => {
    updateChapterMeta.mockRejectedValue(new Error('offline'));
    act(() => api.scheduleContent('c1', '<p>важный текст</p>'));
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    expect(readDraft('c1')?.content).toBe('<p>важный текст</p>');
    expect(readDraft('c1')?.base).toBe('v1');
  });

  it('discard ждёт запрос в полёте и чистит черновик', async () => {
    let release!: () => void;
    updateChapterMeta.mockImplementation(async (id) => {
      await new Promise<void>((r) => { release = r; });
      return meta(id, 'v2');
    });
    writeDraft('c1', '<p>x</p>', 'v1');
    act(() => api.scheduleContent('c1', '<p>x</p>'));
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    let done = false;
    const p = api.discard('c1').then(() => { done = true; });
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(done).toBe(false);
    await act(async () => { release(); await p; });
    expect(done).toBe(true);
    expect(readDraft('c1')).toBeNull();
  });
});
