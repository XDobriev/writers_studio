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
const updateDraftScene = vi.fn((id: string, patch: unknown) => Promise.resolve({ id, ...(patch as object) }));
vi.mock('./draftScenes', () => ({
  updateDraftScene: (id: string, patch: unknown) => updateDraftScene(id, patch),
}));
const recordWritingProgress = vi.fn((..._args: unknown[]) => Promise.resolve(0));
vi.mock('./books', async (orig) => ({
  ...(await orig<typeof import('./books')>()),
  recordWritingProgress: (...a: unknown[]) => recordWritingProgress(...a),
}));

import { useChapterAutosave, useRecoveredChapterContent, type ChapterAutosave } from './useChapterAutosave';
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

function Harness({ bookId = 'b1' }: { bookId?: string }) {
  api = useChapterAutosave({ bookId, userId: 'u1', isPro: true });
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  updateChapterMeta.mockReset();
  getChapterState.mockReset();
  createVersion.mockClear();
  recordWritingProgress.mockReset();
  recordWritingProgress.mockResolvedValue(0);
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

describe('useRecoveredChapterContent', () => {
  function RecoveryHarness() {
    useRecoveredChapterContent(
      'c1', { id: 'c1', content: '<p>серверный текст</p>' }, 'v2', api,
      { userId: 'u1', isPro: true },
    );
    return null;
  }

  it('позднее архивирование конфликтующего черновика сохраняет новый локальный черновик', async () => {
    let release!: () => void;
    createVersion.mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
    writeDraft('c1', '<p>старый черновик</p>', 'v1');
    act(() => {
      root.render(createElement(QueryClientProvider, { client: qc }, createElement(RecoveryHarness)));
    });
    expect(createVersion).toHaveBeenCalledExactlyOnceWith(
      'c1', 'u1', '<p>старый черновик</p>', 2, 'manual', expect.stringContaining('Несохранённый черновик'),
    );
    writeDraft('c1', '<p>новый черновик</p>', 'v2');
    const newDraft = readDraft('c1');

    await act(async () => { release(); });

    expect(readDraft('c1')).toEqual(newDraft);
    expect(readDraft('c1')?.content).toBe('<p>новый черновик</p>');
  });

  it('архивирует и удаляет прежний конфликтующий черновик, если он не изменился', async () => {
    writeDraft('c1', '<p>старый черновик</p>', 'v1');

    await act(async () => {
      root.render(createElement(QueryClientProvider, { client: qc }, createElement(RecoveryHarness)));
    });

    expect(createVersion).toHaveBeenCalledExactlyOnceWith(
      'c1', 'u1', '<p>старый черновик</p>', 2, 'manual', expect.stringContaining('Несохранённый черновик'),
    );
    expect(readDraft('c1')).toBeNull();
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

  it('сохраняет черновик свободной сцены через единый модуль автосохранения', async () => {
    act(() => api.scheduleDraft('d1', { title: 'Сцена 1', content: '<p>Текст сцены</p>' }));
    expect(api.draftSaveState).toBe('saving');
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(updateDraftScene).toHaveBeenCalledWith('d1', { title: 'Сцена 1', content: '<p>Текст сцены</p>' });
    expect(api.draftSaveState).toBe('saved');
  });

  it('cancelDraft отменяет несохранённый черновик', async () => {
    updateDraftScene.mockClear();
    act(() => api.scheduleDraft('d2', { title: 'Отменённая сцена' }));
    act(() => api.cancelDraft('d2'));
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(updateDraftScene).not.toHaveBeenCalled();
  });

  it('отправляет точную дельту слов в recordWritingProgress (включая отрицательную) и синхронизирует кэш book/books/writingSnapshots', async () => {
    qc.setQueryData(QUERY_KEYS.chapters('b1'), [meta('c1', 'v1', { words: 100 }), meta('c2', 'w1', { words: 50 })]);
    qc.setQueryData(QUERY_KEYS.book('b1'), { id: 'b1', words: 150 });
    qc.setQueryData(QUERY_KEYS.books('u1'), [{ id: 'b1', words: 150 }]);
    qc.setQueryData(QUERY_KEYS.writingSnapshots('b1'), []);
    updateChapterMeta.mockImplementation(async (id, patch) => meta(id, 'v2', { words: patch.words ?? 0 }));

    // +3 слова (100 → 103)
    act(() => api.schedule('c1', { content: '<p>текст</p>', words: 103 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });

    expect(recordWritingProgress).toHaveBeenCalledTimes(1);
    expect(recordWritingProgress).toHaveBeenCalledWith(expect.objectContaining({
      bookId: 'b1',
      docKind: 'chapter',
      docId: 'c1',
      delta: 3,
    }));
    expect((qc.getQueryData(QUERY_KEYS.book('b1')) as { words: number }).words).toBe(153);
    expect((qc.getQueryData(QUERY_KEYS.books('u1')) as Array<{ id: string; words: number }>)[0].words).toBe(153);
    expect(qc.getQueryState(QUERY_KEYS.writingSnapshots('b1'))?.isInvalidated).toBe(true);

    // -2 слова (103 → 101)
    act(() => api.schedule('c1', { content: '<p>короче</p>', words: 101 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });

    expect(recordWritingProgress).toHaveBeenCalledTimes(2);
    expect(recordWritingProgress).toHaveBeenLastCalledWith(expect.objectContaining({
      bookId: 'b1',
      docKind: 'chapter',
      docId: 'c1',
      delta: -2,
    }));
    expect((qc.getQueryData(QUERY_KEYS.book('b1')) as { words: number }).words).toBe(151);
  });

  it('правка только заголовка главы не вызывает recordWritingProgress', async () => {
    updateChapterMeta.mockImplementation(async (id, patch) => meta(id, 'v2', { title: patch.title ?? 'Глава' }));
    act(() => api.schedule('c1', { title: 'Новое название' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(recordWritingProgress).not.toHaveBeenCalled();
  });

  it('ошибка recordWritingProgress не ломает сохранение главы, а следующее сохранение догоняет пропущенную дельту', async () => {
    qc.setQueryData(QUERY_KEYS.chapters('b1'), [meta('c1', 'v1', { words: 10 })]);
    updateChapterMeta.mockImplementation(async (id, patch) => meta(id, 'v' + Math.random(), { words: patch.words ?? 0 }));
    recordWritingProgress.mockRejectedValueOnce(new Error('rpc hiccup')).mockResolvedValueOnce(15);

    act(() => api.schedule('c1', { content: '<p>a</p>', words: 20 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(api.saveState).toBe('saved');
    expect(recordWritingProgress).toHaveBeenCalledWith(expect.objectContaining({ delta: 10 }));

    // Следующая правка +5 слов должна отправить +15 (догоняя несохранённые +10)
    act(() => api.schedule('c1', { content: '<p>b</p>', words: 25 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(recordWritingProgress).toHaveBeenLastCalledWith(expect.objectContaining({ delta: 15 }));
  });

  it('rebase сбрасывает базовый счётчик слов главы (откат версии / вставка черновика не дают ложную дельту)', async () => {
    qc.setQueryData(QUERY_KEYS.chapters('b1'), [meta('c1', 'v1', { words: 100 })]);
    updateChapterMeta.mockImplementation(async (id, patch) => meta(id, 'v3', { words: patch.words ?? 0 }));

    act(() => api.schedule('c1', { content: '<p>a</p>', words: 110 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(recordWritingProgress).toHaveBeenLastCalledWith(expect.objectContaining({ delta: 10 }));

    // Структурная вставка черновика +50 слов в c1 (итого 160)
    act(() => api.rebase('c1', 'v2', 160));

    // Затем автор дописывает 4 слова (160 → 164): дельта должна быть +4, а не +54
    act(() => api.schedule('c1', { content: '<p>b</p>', words: 164 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(recordWritingProgress).toHaveBeenLastCalledWith(expect.objectContaining({ delta: 4 }));
  });

  it('автосохранение свободной сцены записывает прогресс с docKind="draft" без изменения book.words', async () => {
    qc.setQueryData(QUERY_KEYS.book('b1'), { id: 'b1', words: 500 });
    qc.setQueryData(QUERY_KEYS.writingSnapshots('b1'), []);
    qc.setQueryData(QUERY_KEYS.draftScenes('b1'), [
      { id: 'd1', book_id: 'b1', user_id: 'u1', title: 'Сцена', content: '', words: 0, position: 0, created_at: '2026-01-01', updated_at: '2026-01-01' },
    ]);

    act(() => api.scheduleDraft('d1', { content: '<p>Раз два три</p>', words: 3 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });

    expect(recordWritingProgress).toHaveBeenCalledWith(expect.objectContaining({
      bookId: 'b1',
      docKind: 'draft',
      docId: 'd1',
      delta: 3,
    }));
    expect((qc.getQueryData(QUERY_KEYS.book('b1')) as { words: number }).words).toBe(500);
    expect(qc.getQueryState(QUERY_KEYS.writingSnapshots('b1'))?.isInvalidated).toBe(true);
  });

  it('для старой главы с расходящимся chapters.words в БД считает дельту по countWords загруженного контента', async () => {
    // Например, старый countWords записал 5 слов из-за утекших мягких переносов/инлайн-тегов,
    // хотя реально в HTML 2 слова («Привет мир»).
    qc.setQueryData(QUERY_KEYS.chapters('b1'), [meta('c1', 'v1', { words: 5 })]);
    qc.setQueryData(QUERY_KEYS.chapterContent('c1'), { id: 'c1', content: '<p><strong>П</strong>ри\u00ADвет мир</p>' });
    updateChapterMeta.mockImplementation(async (id, patch) => meta(id, 'v2', { words: patch.words ?? 0 }));

    // Автор дописал ровно 1 слово → 3 слова. Дельта должна быть +1, а не -2.
    act(() => api.scheduleContent('c1', '<p><strong>П</strong>ривет мир снова</p>'));
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });

    expect(recordWritingProgress).toHaveBeenCalledWith(expect.objectContaining({
      bookId: 'b1',
      docKind: 'chapter',
      docId: 'c1',
      delta: 1,
    }));
  });

  it('при переключении на другую книгу до окончания сохранения пишет прогресс и кэш в book_id документа, а не новой книги', async () => {
    qc.setQueryData(QUERY_KEYS.chapters('b1'), [meta('c1', 'v1', { words: 10 })]);
    qc.setQueryData(QUERY_KEYS.book('b1'), { id: 'b1', words: 10 });
    qc.setQueryData(QUERY_KEYS.book('b2'), { id: 'b2', words: 999 });
    qc.setQueryData(QUERY_KEYS.writingSnapshots('b1'), []);
    qc.setQueryData(QUERY_KEYS.writingSnapshots('b2'), []);
    updateChapterMeta.mockImplementation(async (id, patch) => meta(id, 'v2', { book_id: 'b1', words: patch.words ?? 0 }));

    act(() => api.schedule('c1', { content: '<p>new</p>', words: 17 }));
    // Пользователь переходит на книгу b2 до срабатывания debounce
    act(() => { root.render(createElement(QueryClientProvider, { client: qc }, createElement(Harness, { bookId: 'b2' }))); });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });

    expect(recordWritingProgress).toHaveBeenCalledWith(expect.objectContaining({
      bookId: 'b1',
      docKind: 'chapter',
      docId: 'c1',
      delta: 7,
    }));
    expect((qc.getQueryData(QUERY_KEYS.book('b1')) as { words: number }).words).toBe(17);
    expect((qc.getQueryData(QUERY_KEYS.book('b2')) as { words: number }).words).toBe(999);
    expect(qc.getQueryState(QUERY_KEYS.writingSnapshots('b1'))?.isInvalidated).toBe(true);
    expect(qc.getQueryState(QUERY_KEYS.writingSnapshots('b2'))?.isInvalidated).toBe(false);
  });

  it('drainDraft не затирает более свежие pending-правки черновика устаревшим ответом сервера', async () => {
    qc.setQueryData(QUERY_KEYS.draftScenes('b1'), [
      { id: 'd1', book_id: 'b1', user_id: 'u1', title: 'Сцена', content: '', words: 0, position: 0, created_at: '2026-01-01', updated_at: '2026-01-01' },
    ]);
    let resolveFirst!: (val: unknown) => void;
    updateDraftScene.mockImplementationOnce(() => new Promise((r) => { resolveFirst = r as (val: unknown) => void; }));
    updateDraftScene.mockImplementationOnce(async (_id, patch) => ({
      id: 'd1', book_id: 'b1', user_id: 'u1', title: 'Сцена', position: 0,
      created_at: '2026-01-01', updated_at: '2026-01-03', content: '', words: 0, ...(patch as object),
    }));

    act(() => api.scheduleDraft('d1', { content: '<p>раз два</p>', words: 2 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    // Пока первый запрос в полёте, автор допечатал ещё два слова
    act(() => api.scheduleDraft('d1', { content: '<p>раз два три четыре</p>', words: 4 }));

    await act(async () => {
      resolveFirst({
        id: 'd1', book_id: 'b1', user_id: 'u1', title: 'Сцена', position: 0,
        created_at: '2026-01-01', updated_at: '2026-01-02', content: '<p>раз два</p>', words: 2,
      });
      await Promise.resolve();
    });

    const cached = qc.getQueryData<Array<{ id: string; words: number; content: string }>>(QUERY_KEYS.draftScenes('b1'));
    expect(cached?.[0].words).toBe(4);
    expect(cached?.[0].content).toBe('<p>раз два три четыре</p>');
  });

  it('discard(id, true) полностью сбрасывает pending-патчи (включая title) при удалении главы', async () => {
    act(() => api.schedule('c1', { title: 'Новое название', content: '<p>текст</p>', words: 1 }));
    await act(async () => { await api.discard('c1', true); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(updateChapterMeta).not.toHaveBeenCalled();
  });

  it('pagehide отправляет keepalive record_writing_progress для несохранённой главы и черновика ровно один раз', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    try {
      // Дождёмся резолва getSession() для tokenRef
      await act(async () => { await Promise.resolve(); });
      qc.setQueryData(QUERY_KEYS.chapters('b1'), [meta('c1', 'v1', { words: 10 })]);
      qc.setQueryData(QUERY_KEYS.draftScenes('b1'), [
        { id: 'd1', book_id: 'b1', user_id: 'u1', title: 'Сцена', content: '<p>один</p>', words: 1, position: 0, created_at: '2026-01-01', updated_at: '2026-01-01' },
      ]);

      act(() => {
        api.schedule('c1', { content: '<p>новая правка</p>', words: 25 });
        api.scheduleDraft('d1', { content: '<p>один два три четыре</p>', words: 4 });
      });

      act(() => { window.dispatchEvent(new Event('pagehide')); });

      const rpcCalls = fetchSpy.mock.calls.filter(([url]) => String(url).includes('/rest/v1/rpc/record_writing_progress'));
      expect(rpcCalls).toHaveLength(2);
      const bodies = rpcCalls.map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>);
      expect(bodies).toEqual(expect.arrayContaining([
        expect.objectContaining({ p_book_id: 'b1', p_doc_kind: 'chapter', p_doc_id: 'c1', p_delta: 15 }),
        expect.objectContaining({ p_book_id: 'b1', p_doc_kind: 'draft', p_doc_id: 'd1', p_delta: 3 }),
      ]));
      expect(rpcCalls.every(([, init]) => init?.keepalive === true)).toBe(true);

      // Повторный pagehide (например, после bfcache) не дублирует уже отправленную дельту
      act(() => { window.dispatchEvent(new Event('pagehide')); });
      const rpcCallsAfter = fetchSpy.mock.calls.filter(([url]) => String(url).includes('/rest/v1/rpc/record_writing_progress'));
      expect(rpcCallsAfter).toHaveLength(2);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
