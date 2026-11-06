import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockRepoList,
  mockRepoCreate,
  mockRepoUpdate,
  mockRepoDelete,
  mockCreateChapter,
  mockGetChapterContent,
  mockUpdateChapter,
  mockReorderChapters,
  mockRenumberChapters,
} = vi.hoisted(() => ({
  mockRepoList: vi.fn(),
  mockRepoCreate: vi.fn(),
  mockRepoUpdate: vi.fn(),
  mockRepoDelete: vi.fn(),
  mockCreateChapter: vi.fn(),
  mockGetChapterContent: vi.fn(),
  mockUpdateChapter: vi.fn(),
  mockReorderChapters: vi.fn(),
  mockRenumberChapters: vi.fn(),
}));

vi.mock('./repository', () => ({
  createRepository: () => ({
    list: mockRepoList,
    create: mockRepoCreate,
    update: mockRepoUpdate,
    delete: mockRepoDelete,
  }),
}));

vi.mock('./chapters', async () => {
  const actual = await vi.importActual<typeof import('./chapters')>('./chapters');
  return {
    ...actual,
    createChapter: mockCreateChapter,
    getChapterContent: mockGetChapterContent,
    updateChapter: mockUpdateChapter,
    reorderChapters: mockReorderChapters,
    renumberChapters: mockRenumberChapters,
  };
});

import {
  listDraftScenes,
  createDraftScene,
  updateDraftScene,
  deleteDraftScene,
  mergeSceneIntoChapterContent,
  resolveConvertPosition,
  buildChaptersAfterInsert,
  convertDraftSceneToChapter,
  insertDraftSceneIntoChapter,
  type DraftScene,
} from './draftScenes';
import type { Chapter, ChapterMeta } from './chapters';

function makeChapterMeta(id: string, position: number, title = `Глава ${position + 1}`): ChapterMeta {
  return {
    id,
    book_id: 'book-1',
    user_id: 'user-1',
    title,
    position,
    synopsis: '',
    words: 100,
    status: 'draft',
    created_at: '2026-11-06T00:00:00Z',
    updated_at: '2026-11-06T00:00:00Z',
  };
}

function makeDraftScene(overrides: Partial<DraftScene> = {}): DraftScene {
  return {
    id: 'draft-1',
    book_id: 'book-1',
    user_id: 'user-1',
    title: 'Ночной разговор на мосту',
    content: '<p>Туман поднимался над рекой.</p><p>Шаги затихли вдали.</p>',
    words: 7,
    position: 0,
    created_at: '2026-11-06T00:00:00Z',
    updated_at: '2026-11-06T00:00:00Z',
    ...overrides,
  };
}

describe('draftScenes repository CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listDraftScenes вызывает repo.list по bookId', async () => {
    const scenes = [makeDraftScene()];
    mockRepoList.mockResolvedValueOnce(scenes);

    const res = await listDraftScenes('book-1');
    expect(mockRepoList).toHaveBeenCalledWith('book-1');
    expect(res).toEqual(scenes);
  });

  it('createDraftScene автоматически считает слова и ставит дефолты', async () => {
    const created = makeDraftScene({ title: 'Сцена у костра', content: '<p>Три слова тут</p>', words: 3, position: 2 });
    mockRepoCreate.mockResolvedValueOnce(created);

    const res = await createDraftScene('book-1', 'user-1', {
      title: 'Сцена у костра',
      content: '<p>Три слова тут</p>',
      position: 2,
    });

    expect(mockRepoCreate).toHaveBeenCalledWith('book-1', 'user-1', {
      title: 'Сцена у костра',
      content: '<p>Три слова тут</p>',
      words: 3,
      position: 2,
    });
    expect(res).toEqual(created);
  });

  it('updateDraftScene пересчитывает слова при передаче content без words', async () => {
    const updated = makeDraftScene({ content: '<p>Один два три четыре</p>', words: 4 });
    mockRepoUpdate.mockResolvedValueOnce(updated);

    await updateDraftScene('draft-1', { content: '<p>Один два три четыре</p>' });
    expect(mockRepoUpdate).toHaveBeenCalledWith('draft-1', {
      content: '<p>Один два три четыре</p>',
      words: 4,
    });
  });

  it('updateDraftScene не трогает words при обновлении только title', async () => {
    const updated = makeDraftScene({ title: 'Новое название' });
    mockRepoUpdate.mockResolvedValueOnce(updated);

    await updateDraftScene('draft-1', { title: 'Новое название' });
    expect(mockRepoUpdate).toHaveBeenCalledWith('draft-1', { title: 'Новое название' });
  });

  it('deleteDraftScene удаляет черновик по id', async () => {
    mockRepoDelete.mockResolvedValueOnce(undefined);
    await deleteDraftScene('draft-1');
    expect(mockRepoDelete).toHaveBeenCalledWith('draft-1');
  });
});

describe('resolveConvertPosition & buildChaptersAfterInsert', () => {
  const chapters = [
    makeChapterMeta('c1', 0, 'Глава 1'),
    makeChapterMeta('c2', 1, 'Глава 2'),
    makeChapterMeta('c3', 2, 'Глава 3'),
  ];

  it('вычисляет индекс для start, end и after', () => {
    expect(resolveConvertPosition(chapters, { mode: 'start' })).toBe(0);
    expect(resolveConvertPosition(chapters, { mode: 'end' })).toBe(3);
    expect(resolveConvertPosition(chapters, { mode: 'after', afterChapterId: 'c1' })).toBe(1);
    expect(resolveConvertPosition(chapters, { mode: 'after', afterChapterId: 'c2' })).toBe(2);
    expect(resolveConvertPosition(chapters, { mode: 'after', afterChapterId: 'c3' })).toBe(3);
    expect(resolveConvertPosition(chapters, { mode: 'after', afterChapterId: 'missing' })).toBe(3);
    expect(resolveConvertPosition([], { mode: 'start' })).toBe(0);
  });

  it('вставка в конец не требует reorder существующих глав с правильными позициями', () => {
    const createdMeta = makeChapterMeta('c4', 3, 'Глава 4');
    const { nextChapters, reorderUpdates } = buildChaptersAfterInsert(chapters, createdMeta, 3);
    expect(nextChapters.map((c) => c.id)).toEqual(['c1', 'c2', 'c3', 'c4']);
    expect(nextChapters.map((c) => c.position)).toEqual([0, 1, 2, 3]);
    expect(reorderUpdates).toEqual([]);
  });

  it('вставка в начало сдвигает позиции всех существующих глав', () => {
    const createdMeta = makeChapterMeta('c0', 0, 'Пролог');
    const { nextChapters, reorderUpdates } = buildChaptersAfterInsert(chapters, createdMeta, 0);
    expect(nextChapters.map((c) => c.id)).toEqual(['c0', 'c1', 'c2', 'c3']);
    expect(nextChapters.map((c) => c.position)).toEqual([0, 1, 2, 3]);
    expect(reorderUpdates).toEqual([
      { id: 'c1', position: 1 },
      { id: 'c2', position: 2 },
      { id: 'c3', position: 3 },
    ]);
  });

  it('вставка после первой главы сдвигает только последующие главы', () => {
    const createdMeta = makeChapterMeta('c-mid', 1, 'Вставная сцена');
    const { nextChapters, reorderUpdates } = buildChaptersAfterInsert(chapters, createdMeta, 1);
    expect(nextChapters.map((c) => c.id)).toEqual(['c1', 'c-mid', 'c2', 'c3']);
    expect(reorderUpdates).toEqual([
      { id: 'c2', position: 2 },
      { id: 'c3', position: 3 },
    ]);
  });
});

describe('mergeSceneIntoChapterContent', () => {
  it('дописывает сцену в конец существующей главы без потери HTML', () => {
    expect(
      mergeSceneIntoChapterContent('<p>Начало главы.</p>', '<p>Свободная сцена.</p>', 'end'),
    ).toBe('<p>Начало главы.</p><p>Свободная сцена.</p>');
  });

  it('вставляет сцену в начало существующей главы', () => {
    expect(
      mergeSceneIntoChapterContent('<p>Текст главы.</p>', '<p>Пролог сцены.</p>', 'start'),
    ).toBe('<p>Пролог сцены.</p><p>Текст главы.</p>');
  });

  it('не плодит пустые абзацы, если глава была пустой', () => {
    expect(mergeSceneIntoChapterContent('', '<p>Сцена.</p>', 'end')).toBe('<p>Сцена.</p>');
    expect(mergeSceneIntoChapterContent('<p></p>', '<p>Сцена.</p>', 'start')).toBe('<p>Сцена.</p>');
    expect(mergeSceneIntoChapterContent('<p>   </p>', '<p>Сцена.</p>', 'end')).toBe('<p>Сцена.</p>');
  });

  it('возвращает исходный текст главы, если сцена пустая', () => {
    expect(mergeSceneIntoChapterContent('<p>Глава.</p>', '', 'end')).toBe('<p>Глава.</p>');
    expect(mergeSceneIntoChapterContent('<p>Глава.</p>', '<p></p>', 'start')).toBe('<p>Глава.</p>');
  });

  it('разделяет plain-text строки двойным переводом строки', () => {
    expect(mergeSceneIntoChapterContent('Первый абзац', 'Второй абзац', 'end')).toBe(
      'Первый абзац\n\nВторой абзац',
    );
  });
});

describe('convertDraftSceneToChapter', () => {
  const existing = [
    makeChapterMeta('c1', 0, 'Глава 1'),
    makeChapterMeta('c2', 1, 'Глава 2'),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('превращает черновик в главу в конце книги и удаляет черновик', async () => {
    const scene = makeDraftScene();
    const createdChapter: Chapter = {
      ...makeChapterMeta('c3', 2, scene.title),
      content: scene.content,
      words: 7,
    };
    mockCreateChapter.mockResolvedValueOnce(createdChapter);
    mockRepoDelete.mockResolvedValueOnce(undefined);

    const result = await convertDraftSceneToChapter(scene, existing, { mode: 'end' });

    expect(mockCreateChapter).toHaveBeenCalledWith('book-1', 'user-1', {
      title: 'Ночной разговор на мосту',
      content: '<p>Туман поднимался над рекой.</p><p>Шаги затихли вдали.</p>',
      words: 7,
      position: 2,
    });
    expect(mockReorderChapters).not.toHaveBeenCalled();
    expect(mockRepoDelete).toHaveBeenCalledWith('draft-1');
    expect(result.chapter.id).toBe('c3');
    expect(result.nextChapters.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('превращает черновик в главу после выбранной главы и перенумеровывает позиции', async () => {
    const scene = makeDraftScene({ title: '   ' });
    const createdChapter: Chapter = {
      ...makeChapterMeta('c-new', 1, 'Без названия'),
      content: scene.content,
      words: 7,
    };
    mockCreateChapter.mockResolvedValueOnce(createdChapter);
    mockReorderChapters.mockResolvedValueOnce(undefined);
    mockRepoDelete.mockResolvedValueOnce(undefined);

    const result = await convertDraftSceneToChapter(scene, existing, {
      mode: 'after',
      afterChapterId: 'c1',
    });

    expect(mockCreateChapter).toHaveBeenCalledWith('book-1', 'user-1', {
      title: 'Без названия',
      content: scene.content,
      words: 7,
      position: 1,
    });
    expect(mockReorderChapters).toHaveBeenCalledWith([{ id: 'c2', position: 2 }]);
    expect(mockRepoDelete).toHaveBeenCalledWith('draft-1');
    expect(result.nextChapters.map((c) => ({ id: c.id, position: c.position }))).toEqual([
      { id: 'c1', position: 0 },
      { id: 'c-new', position: 1 },
      { id: 'c2', position: 2 },
    ]);
  });

  it('не удаляет черновик при ошибке создания главы', async () => {
    const scene = makeDraftScene();
    mockCreateChapter.mockRejectedValueOnce(new Error('DB failure'));

    await expect(
      convertDraftSceneToChapter(scene, existing, { mode: 'end' }),
    ).rejects.toThrow('DB failure');
    expect(mockRepoDelete).not.toHaveBeenCalled();
  });

  it('автоматически синхронизирует сквозную нумерацию глав при вставке нумерованной главы в начало', async () => {
    const scene = makeDraftScene({ title: 'Глава 1. Новое начало' });
    const createdChapter: Chapter = {
      ...makeChapterMeta('c0', 0, 'Глава 1. Новое начало'),
      content: scene.content,
      words: 7,
    };
    mockCreateChapter.mockResolvedValueOnce(createdChapter);
    mockReorderChapters.mockResolvedValueOnce(undefined);
    mockRenumberChapters.mockResolvedValueOnce(undefined);
    mockRepoDelete.mockResolvedValueOnce(undefined);

    const result = await convertDraftSceneToChapter(scene, existing, { mode: 'start' });

    expect(mockReorderChapters).toHaveBeenCalledWith([
      { id: 'c1', position: 1 },
      { id: 'c2', position: 2 },
    ]);
    expect(mockRenumberChapters).toHaveBeenCalledWith([
      { id: 'c1', title: 'Глава 2', book_id: 'book-1', user_id: 'user-1' },
      { id: 'c2', title: 'Глава 3', book_id: 'book-1', user_id: 'user-1' },
    ]);
    expect(result.nextChapters.map((c) => ({ id: c.id, title: c.title, position: c.position }))).toEqual([
      { id: 'c0', title: 'Глава 1. Новое начало', position: 0 },
      { id: 'c1', title: 'Глава 2', position: 1 },
      { id: 'c2', title: 'Глава 3', position: 2 },
    ]);
  });
});

describe('insertDraftSceneIntoChapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('дописывает текст черновика в конец существующей главы, пересчитывает слова и удаляет черновик', async () => {
    const scene = makeDraftScene({
      content: '<p>Дополнительная сцена из четырёх слов</p>',
      words: 5,
    });
    mockGetChapterContent.mockResolvedValueOnce({
      id: 'c1',
      content: '<p>Исходный текст главы</p>',
    });
    const updatedChapter: Chapter = {
      ...makeChapterMeta('c1', 0, 'Глава 1'),
      content: '<p>Исходный текст главы</p><p>Дополнительная сцена из четырёх слов</p>',
      words: 8,
    };
    mockUpdateChapter.mockResolvedValueOnce(updatedChapter);
    mockRepoDelete.mockResolvedValueOnce(undefined);

    const res = await insertDraftSceneIntoChapter(scene, 'c1', 'end');

    expect(mockGetChapterContent).toHaveBeenCalledWith('c1');
    expect(mockUpdateChapter).toHaveBeenCalledWith('c1', {
      content: '<p>Исходный текст главы</p><p>Дополнительная сцена из четырёх слов</p>',
      words: 8,
    });
    expect(mockRepoDelete).toHaveBeenCalledWith('draft-1');
    expect(res).toEqual(updatedChapter);
  });

  it('вставляет текст черновика в начало главы', async () => {
    const scene = makeDraftScene({
      content: '<p>Эпиграф сцены</p>',
      words: 2,
    });
    mockGetChapterContent.mockResolvedValueOnce({
      id: 'c1',
      content: '<p>Основной текст</p>',
    });
    const updatedChapter: Chapter = {
      ...makeChapterMeta('c1', 0, 'Глава 1'),
      content: '<p>Эпиграф сцены</p><p>Основной текст</p>',
      words: 4,
    };
    mockUpdateChapter.mockResolvedValueOnce(updatedChapter);
    mockRepoDelete.mockResolvedValueOnce(undefined);

    await insertDraftSceneIntoChapter(scene, 'c1', 'start');

    expect(mockUpdateChapter).toHaveBeenCalledWith('c1', {
      content: '<p>Эпиграф сцены</p><p>Основной текст</p>',
      words: 4,
    });
    expect(mockRepoDelete).toHaveBeenCalledWith('draft-1');
  });

  it('не удаляет черновик, если обновление главы упало с ошибкой', async () => {
    const scene = makeDraftScene();
    mockGetChapterContent.mockResolvedValueOnce({ id: 'c1', content: '<p>Текст</p>' });
    mockUpdateChapter.mockRejectedValueOnce(new Error('Network error'));

    await expect(insertDraftSceneIntoChapter(scene, 'c1', 'end')).rejects.toThrow('Network error');
    expect(mockRepoDelete).not.toHaveBeenCalled();
  });
});
