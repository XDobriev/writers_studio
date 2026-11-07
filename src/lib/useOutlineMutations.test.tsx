// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ChapterMeta } from './chapters';
import type { DraftScene } from './draftScenes';
import { QUERY_KEYS } from './queries';

const createChapterMock = vi.fn();
const renumberChaptersMock = vi.fn();
const createDraftSceneMock = vi.fn();
const deleteDraftSceneMock = vi.fn();
const convertDraftSceneToChapterMock = vi.fn();
const insertDraftSceneIntoChapterMock = vi.fn();

vi.mock('./supabase', () => ({
  supabase: {},
  ensureAuthReady: vi.fn(),
}));

vi.mock('./chapters', async (orig) => ({
  ...(await orig<typeof import('./chapters')>()),
  createChapter: (...args: unknown[]) => createChapterMock(...args),
  renumberChapters: (...args: unknown[]) => renumberChaptersMock(...args),
}));

vi.mock('./draftScenes', () => ({
  createDraftScene: (...args: unknown[]) => createDraftSceneMock(...args),
  deleteDraftScene: (...args: unknown[]) => deleteDraftSceneMock(...args),
  convertDraftSceneToChapter: (...args: unknown[]) => convertDraftSceneToChapterMock(...args),
  insertDraftSceneIntoChapter: (...args: unknown[]) => insertDraftSceneIntoChapterMock(...args),
}));

import { useOutlineMutations } from './useOutlineMutations';

describe('useOutlineMutations chapter types & numbering', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  let queryClient: QueryClient;
  let mutations: ReturnType<typeof useOutlineMutations> | null = null;
  const navigateMock = vi.fn();
  const setErrorMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    if (container) {
      container.remove();
    }
  });

  function setup(
    chapters: ChapterMeta[],
    draftScenes: DraftScene[] = [],
    onCancelDraftSave?: (id: string) => void,
  ) {
    queryClient.setQueryData(QUERY_KEYS.chapters('book-1'), chapters);
    queryClient.setQueryData(QUERY_KEYS.draftScenes('book-1'), draftScenes);

    function TestComponent() {
      mutations = useOutlineMutations({
        bookId: 'book-1',
        userId: 'user-1',
        chapters,
        draftScenes,
        navigate: navigateMock,
        setError: setErrorMock,
        onCancelDraftSave,
      });
      return null;
    }

    act(() => {
      root?.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(TestComponent),
        ),
      );
    });
  }

  it('onCreate после Пролога создает Главу 1 (а не Главу 2)', async () => {
    const chapters: ChapterMeta[] = [
      {
        id: 'c-prologue',
        book_id: 'book-1',
        user_id: 'user-1',
        title: 'Пролог',
        position: 0,
        words: 100,
        status: 'draft',
        synopsis: '',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ];

    createChapterMock.mockResolvedValueOnce({
      id: 'c-1',
      book_id: 'book-1',
      user_id: 'user-1',
      title: 'Глава 1',
      position: 1,
      words: 0,
      status: 'draft',
      synopsis: '',
      created_at: '2026-01-02',
      updated_at: '2026-01-02',
    });

    setup(chapters);

    await act(async () => {
      await mutations?.onCreate();
    });

    expect(createChapterMock).toHaveBeenCalledWith('book-1', 'user-1', {
      title: 'Глава 1',
      position: 1,
    });
    expect(navigateMock).toHaveBeenCalledWith('/books/book-1/editor?chapter=c-1');
  });

  it('onTypeChange при смене первой главы на Пролог сдвигает нумерацию следующей главы на Главу 1', async () => {
    const chapters: ChapterMeta[] = [
      {
        id: 'c-1',
        book_id: 'book-1',
        user_id: 'user-1',
        title: 'Глава 1. Начало',
        position: 0,
        words: 500,
        status: 'draft',
        synopsis: '',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: 'c-2',
        book_id: 'book-1',
        user_id: 'user-1',
        title: 'Глава 2. Путь героя',
        position: 1,
        words: 700,
        status: 'draft',
        synopsis: '',
        created_at: '2026-01-02',
        updated_at: '2026-01-02',
      },
    ];

    renumberChaptersMock.mockResolvedValueOnce(undefined);
    setup(chapters);

    await act(async () => {
      await mutations?.onTypeChange('c-1', 'prologue');
    });

    // Должен вызвать renumberChapters с обновленными заголовками
    expect(renumberChaptersMock).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'c-1', title: 'Пролог. Начало' }),
      expect.objectContaining({ id: 'c-2', title: 'Глава 1. Путь героя' }),
    ]);

    // React Query кэш должен содержать обновленные главы
    const cached = queryClient.getQueryData<ChapterMeta[]>(QUERY_KEYS.chapters('book-1'));
    expect(cached?.[0].title).toBe('Пролог. Начало');
    expect(cached?.[1].title).toBe('Глава 1. Путь героя');
  });

  it('onTypeChange на интерлюдию не увеличивает номер следующей главы', async () => {
    const chapters: ChapterMeta[] = [
      {
        id: 'c-1',
        book_id: 'book-1',
        user_id: 'user-1',
        title: 'Глава 1',
        position: 0,
        words: 500,
        status: 'draft',
        synopsis: '',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: 'c-2',
        book_id: 'book-1',
        user_id: 'user-1',
        title: 'Глава 2. Тайны',
        position: 1,
        words: 700,
        status: 'draft',
        synopsis: '',
        created_at: '2026-01-02',
        updated_at: '2026-01-02',
      },
      {
        id: 'c-3',
        book_id: 'book-1',
        user_id: 'user-1',
        title: 'Глава 3. Развязка',
        position: 2,
        words: 900,
        status: 'draft',
        synopsis: '',
        created_at: '2026-01-03',
        updated_at: '2026-01-03',
      },
    ];

    renumberChaptersMock.mockResolvedValueOnce(undefined);
    setup(chapters);

    await act(async () => {
      await mutations?.onTypeChange('c-2', 'interlude');
    });

    expect(renumberChaptersMock).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'c-2', title: 'Интерлюдия. Тайны' }),
      expect.objectContaining({ id: 'c-3', title: 'Глава 2. Развязка' }),
    ]);
  });

  it('createDraft создает черновик сцены и обновляет кэш draftScenes', async () => {
    setup([]);
    createDraftSceneMock.mockResolvedValueOnce({
      id: 'd-1',
      book_id: 'book-1',
      user_id: 'user-1',
      title: 'Сцена 1',
      position: 0,
      content: '',
      words: 0,
    });

    let created: unknown;
    await act(async () => {
      created = await mutations?.createDraft();
    });

    expect(createDraftSceneMock).toHaveBeenCalledWith('book-1', 'user-1', {
      title: 'Сцена 1',
      position: 0,
    });
    expect(created).toMatchObject({ id: 'd-1', title: 'Сцена 1' });
    expect(queryClient.getQueryData(QUERY_KEYS.draftScenes('book-1'))).toEqual([
      expect.objectContaining({ id: 'd-1' }),
    ]);
  });

  it('deleteDraft удаляет черновик сцены и обновляет кэш', async () => {
    setup([]);
    queryClient.setQueryData(QUERY_KEYS.draftScenes('book-1'), [
      { id: 'd-1', title: 'Сцена 1' },
      { id: 'd-2', title: 'Сцена 2' },
    ]);
    deleteDraftSceneMock.mockResolvedValueOnce(undefined);

    let ok = false;
    await act(async () => {
      ok = (await mutations?.deleteDraft('d-1')) ?? false;
    });

    expect(ok).toBe(true);
    expect(deleteDraftSceneMock).toHaveBeenCalledWith('d-1');
    expect(queryClient.getQueryData(QUERY_KEYS.draftScenes('book-1'))).toEqual([
      { id: 'd-2', title: 'Сцена 2' },
    ]);
  });

  it('convertDraftToChapter вызывает convertDraftSceneToChapter, обновляет кэш глав и удаляет черновик из кэша', async () => {
    const existingChapters: ChapterMeta[] = [
      {
        id: 'c-1',
        book_id: 'book-1',
        user_id: 'user-1',
        title: 'Глава 1',
        position: 0,
        words: 500,
        status: 'draft',
        synopsis: '',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ];
    const draft: DraftScene = {
      id: 'd-1',
      book_id: 'book-1',
      user_id: 'user-1',
      title: 'Сцена 1',
      content: '<p>Текст</p>',
      words: 10,
      position: 0,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };
    const cancelMock = vi.fn();
    setup(existingChapters, [draft], cancelMock);

    const convertedChapter = {
      ...existingChapters[0],
      id: 'c-2',
      title: 'Глава 2',
      position: 1,
      content: '<p>Текст</p>',
      words: 10,
    };
    const nextChapters = [...existingChapters, { ...convertedChapter }];
    convertDraftSceneToChapterMock.mockResolvedValueOnce({
      chapter: convertedChapter,
      nextChapters,
    });

    let res: unknown;
    await act(async () => {
      res = await mutations?.convertDraftToChapter('d-1', { mode: 'end' });
    });

    expect(cancelMock).toHaveBeenCalledWith('d-1');
    expect(convertDraftSceneToChapterMock).toHaveBeenCalledWith(draft, existingChapters, { mode: 'end' });
    expect(res).toEqual({ chapter: convertedChapter, nextChapters });
    expect(queryClient.getQueryData(QUERY_KEYS.chapters('book-1'))).toEqual(nextChapters);
    expect(queryClient.getQueryData(QUERY_KEYS.draftScenes('book-1'))).toEqual([]);
    expect(queryClient.getQueryData(QUERY_KEYS.chapterContent('c-2'))).toEqual({
      id: 'c-2',
      content: '<p>Текст</p>',
    });
  });

  it('insertDraftToChapter вызывает insertDraftSceneIntoChapter и обновляет кэш главы и черновиков', async () => {
    const existingChapters: ChapterMeta[] = [
      {
        id: 'c-1',
        book_id: 'book-1',
        user_id: 'user-1',
        title: 'Глава 1',
        position: 0,
        words: 500,
        status: 'draft',
        synopsis: '',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ];
    const draft: DraftScene = {
      id: 'd-1',
      book_id: 'book-1',
      user_id: 'user-1',
      title: 'Сцена 1',
      content: '<p>Текст</p>',
      words: 10,
      position: 0,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };
    const cancelMock = vi.fn();
    setup(existingChapters, [draft], cancelMock);

    const updatedChapter = {
      ...existingChapters[0],
      words: 510,
      content: '<p>Старый текст</p><p>Текст</p>',
      updated_at: '2026-01-02',
    };
    insertDraftSceneIntoChapterMock.mockResolvedValueOnce(updatedChapter);

    let res: unknown;
    await act(async () => {
      res = await mutations?.insertDraftToChapter('d-1', 'c-1', 'end');
    });

    expect(cancelMock).toHaveBeenCalledWith('d-1');
    expect(insertDraftSceneIntoChapterMock).toHaveBeenCalledWith(draft, 'c-1', 'end');
    expect(res).toEqual(updatedChapter);
    expect(queryClient.getQueryData(QUERY_KEYS.draftScenes('book-1'))).toEqual([]);
    expect(queryClient.getQueryData(QUERY_KEYS.chapterContent('c-1'))).toEqual({
      id: 'c-1',
      content: '<p>Старый текст</p><p>Текст</p>',
    });
  });
});
