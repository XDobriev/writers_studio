// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import type { ChapterMeta } from '../../lib/chapters';
import type { DraftScene, DraftSceneActions } from '../../lib/draftScenes';

vi.mock('../../lib/useFeatureFlag', () => ({
  useFeatureFlag: () => ({ enabled: false, loading: false }),
}));

vi.mock('./SidebarFoot', () => ({
  SidebarFoot: () => createElement('div', { 'data-testid': 'sidebar-foot' }),
}));

function makeChapter(id: string, position: number, title: string): ChapterMeta {
  return {
    id,
    book_id: 'book-1',
    user_id: 'user-1',
    title,
    position,
    synopsis: '',
    words: 150,
    status: 'draft',
    created_at: '2026-11-06T00:00:00Z',
    updated_at: '2026-11-06T00:00:00Z',
  };
}

function makeDraft(id: string, position: number, title: string, words = 42): DraftScene {
  return {
    id,
    book_id: 'book-1',
    user_id: 'user-1',
    title,
    content: '<p>Текст черновика</p>',
    words,
    position,
    created_at: '2026-11-06T00:00:00Z',
    updated_at: '2026-11-06T00:00:00Z',
  };
}

describe('Sidebar — секция «Черновики / Свободные сцены» (F-13)', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
    container?.remove();
  });

  function renderSidebar(props: {
    chapters?: ChapterMeta[];
    draftScenes?: DraftScene[];
    activeDraftId?: string | null;
    draftActions?: DraftSceneActions;
  }) {
    act(() => {
      root?.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(MemoryRouter, null, createElement(Sidebar, { ...props, demo: true })),
        ),
      );
    });
  }

  it('не рендерит секцию черновиков на страницах без draftScenes и draftActions (например, Dashboard)', () => {
    renderSidebar({
      chapters: [makeChapter('c1', 0, 'Глава 1')],
    });
    expect(container?.textContent).toContain('Глава 1');
    expect(container?.textContent).not.toContain('Черновики / Свободные сцены');
  });

  it('рендерит складную секцию со счётчиком и списком черновиков, поддерживает сворачивание и кнопку «+»', () => {
    const onCreateDraft = vi.fn();
    const onSelectDraft = vi.fn();
    const drafts = [
      makeDraft('d1', 0, 'Сцена в таверне', 120),
      makeDraft('d2', 1, 'Диалог на крыше', 85),
    ];

    renderSidebar({
      chapters: [makeChapter('c1', 0, 'Глава 1')],
      draftScenes: drafts,
      activeDraftId: 'd1',
      draftActions: { onCreateDraft, onSelectDraft },
    });

    expect(container?.textContent).toContain('Черновики / Свободные сцены (2)');
    expect(container?.textContent).toContain('Сцена в таверне');
    expect(container?.textContent).toContain('120 сл');
    expect(container?.textContent).toContain('Диалог на крыше');

    // Сворачивание секции
    const toggleBtn = container?.querySelector('button[aria-expanded="true"]') as HTMLButtonElement;
    expect(toggleBtn).toBeTruthy();
    act(() => {
      toggleBtn.click();
    });
    expect(container?.textContent).not.toContain('Сцена в таверне');

    // Клик по «+» разворачивает секцию и вызывает onCreateDraft
    const addBtn = container?.querySelector('button[aria-label="Новый черновик сцены"]') as HTMLButtonElement;
    expect(addBtn).toBeTruthy();
    act(() => {
      addBtn.click();
    });
    expect(onCreateDraft).toHaveBeenCalledTimes(1);
    expect(container?.textContent).toContain('Сцена в таверне');
  });

  it('открывает контекстное меню черновика и вызывает превращение в главу, вставку в существующую главу и удаление с подтверждением', () => {
    const onConvertDraftToChapter = vi.fn();
    const onInsertDraftIntoChapter = vi.fn();
    const onDeleteDraft = vi.fn();
    const chapters = [
      makeChapter('c1', 0, 'Глава 1'),
      makeChapter('c2', 1, 'Глава 2'),
    ];
    const drafts = [makeDraft('d1', 0, 'Ночная погоня', 64)];

    renderSidebar({
      chapters,
      draftScenes: drafts,
      draftActions: {
        onConvertDraftToChapter,
        onInsertDraftIntoChapter,
        onDeleteDraft,
      },
    });

    const menuTrigger = container?.querySelector(
      'button[aria-label="Действия с черновиком: Ночная погоня"]',
    ) as HTMLButtonElement;
    expect(menuTrigger).toBeTruthy();

    // 1. Превратить в главу (после выбранной главы)
    act(() => {
      menuTrigger.click();
    });

    const afterModeBtn = Array.from(container!.querySelectorAll('button')).find(
      (b) => b.textContent === 'После…',
    )!;
    act(() => {
      afterModeBtn.click();
    });

    const afterSelect = container?.querySelector('select[aria-label="После какой главы"]') as HTMLSelectElement;
    expect(afterSelect).toBeTruthy();
    act(() => {
      afterSelect.value = 'c1';
      afterSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const convertConfirmBtn = Array.from(container!.querySelectorAll<HTMLButtonElement>('button.ctx-item')).find(
      (b) => b.textContent === 'Превратить в главу',
    )!;
    act(() => {
      convertConfirmBtn.click();
    });
    expect(onConvertDraftToChapter).toHaveBeenCalledWith('d1', { mode: 'after', afterChapterId: 'c1' });

    // 2. Вставить в существующую главу (в начало главы)
    act(() => {
      menuTrigger.click();
    });

    const startPosBtn = Array.from(container!.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent === 'В начало главы',
    )!;
    act(() => {
      startPosBtn.click();
    });

    const insertConfirmBtn = Array.from(container!.querySelectorAll<HTMLButtonElement>('button.ctx-item')).find(
      (b) => b.textContent === 'Вставить в существующую главу',
    )!;
    act(() => {
      insertConfirmBtn.click();
    });
    expect(onInsertDraftIntoChapter).toHaveBeenCalledWith('d1', 'c1', 'start');

    // 3. Удалить черновик с подтверждением
    act(() => {
      menuTrigger.click();
    });

    const deleteBtn = Array.from(container!.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent === 'Удалить черновик',
    )!;
    act(() => {
      deleteBtn.click();
    });
    expect(onDeleteDraft).not.toHaveBeenCalled();
    expect(container?.textContent).toContain('Удалить черновик? Текст будет потерян.');

    const confirmDeleteBtn = Array.from(container!.querySelectorAll<HTMLButtonElement>('button.btn-inline-danger')).find(
      (b) => b.textContent === 'Удалить',
    )!;
    act(() => {
      confirmDeleteBtn.click();
    });
    expect(onDeleteDraft).toHaveBeenCalledWith('d1');
  });

  it('позволяет выбирать главу через кастомный выпадающий список (listbox option)', () => {
    const onConvertDraftToChapter = vi.fn();
    const chapters = [
      makeChapter('c1', 0, 'Первая глава'),
      makeChapter('c2', 1, 'Вторая глава'),
    ];
    const drafts = [makeDraft('d1', 0, 'Эпизод', 50)];

    renderSidebar({
      chapters,
      draftScenes: drafts,
      draftActions: { onConvertDraftToChapter },
    });

    const menuTrigger = container?.querySelector(
      'button[aria-label="Действия с черновиком: Эпизод"]',
    ) as HTMLButtonElement;
    act(() => {
      menuTrigger.click();
    });

    const afterModeBtn = Array.from(container!.querySelectorAll('button')).find(
      (b) => b.textContent === 'После…',
    )!;
    act(() => {
      afterModeBtn.click();
    });

    // Находим кнопку-триггер кастомного селекта
    const customSelectTrigger = container?.querySelector('button[aria-label="После какой главы"]') as HTMLButtonElement;
    expect(customSelectTrigger).toBeTruthy();

    // Кликаем по триггеру для открытия списка опций
    act(() => {
      customSelectTrigger.click();
    });

    // Находим опцию "После: 1. Первая глава" в кастомном role="listbox"
    const option1 = Array.from(container!.querySelectorAll<HTMLButtonElement>('button[role="option"]')).find(
      (b) => b.textContent?.includes('Первая глава'),
    )!;
    expect(option1).toBeTruthy();

    act(() => {
      option1.click();
    });

    // Подтверждаем перенос
    const convertConfirmBtn = Array.from(container!.querySelectorAll<HTMLButtonElement>('button.ctx-item')).find(
      (b) => b.textContent === 'Превратить в главу',
    )!;
    act(() => {
      convertConfirmBtn.click();
    });

    expect(onConvertDraftToChapter).toHaveBeenCalledWith('d1', { mode: 'after', afterChapterId: 'c1' });
  });
});
