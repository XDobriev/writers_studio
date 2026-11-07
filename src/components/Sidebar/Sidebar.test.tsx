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

  it('открывает компактное контекстное меню черновика и вызывает превращение в главу, вставку и удаление через модальные окна', async () => {
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

    // 1. Открытие контекстного меню и вызов модалки «Превратить в отдельную главу…»
    act(() => {
      menuTrigger.click();
    });

    const ctxMenu = container?.querySelector('.ctx-menu');
    expect(ctxMenu).toBeTruthy();
    expect(ctxMenu?.textContent).toContain('Превратить в отдельную главу…');
    expect(ctxMenu?.textContent).toContain('Вставить в существующую главу…');
    expect(ctxMenu?.textContent).toContain('Удалить черновик');

    const convertMenuItem = Array.from(ctxMenu!.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Превратить в отдельную главу…'),
    )!;
    act(() => {
      convertMenuItem.click();
    });

    // Меню закрылось, открылась модалка превращения в главу
    expect(container?.querySelector('.ctx-menu')).toBeNull();
    const convertDialog = container?.querySelector('div[aria-labelledby="convert-draft-modal-title"]');
    expect(convertDialog).toBeTruthy();
    expect(convertDialog?.textContent).toContain('Превратить сцену в главу');

    // Переключаем в режим «После выбранной главы» и выбираем главу c1
    const afterBtn = Array.from(convertDialog!.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('После выбранной главы'),
    )!;
    act(() => {
      afterBtn.click();
    });

    const afterSelect = convertDialog?.querySelector('select#convert-after-chapter') as HTMLSelectElement;
    expect(afterSelect).toBeTruthy();
    act(() => {
      afterSelect.value = 'c1';
      afterSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const confirmConvertBtn = Array.from(convertDialog!.querySelectorAll<HTMLButtonElement>('button.btn--primary')).find(
      (b) => b.textContent?.includes('Превратить в главу'),
    )!;
    act(() => {
      confirmConvertBtn.click();
    });
    expect(onConvertDraftToChapter).toHaveBeenCalledWith('d1', { mode: 'after', afterChapterId: 'c1' });

    // 2. Вставить в существующую главу через модалку
    act(() => {
      menuTrigger.click();
    });

    const insertMenuItem = Array.from(container!.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Вставить в существующую главу…'),
    )!;
    act(() => {
      insertMenuItem.click();
    });

    const insertDialog = container?.querySelector('div[aria-labelledby="insert-draft-modal-title"]');
    expect(insertDialog).toBeTruthy();
    expect(insertDialog?.textContent).toContain('Вставить в существующую главу');

    // Выбираем вставку в начало
    const startPosBtn = Array.from(insertDialog!.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Вставить в начало'),
    )!;
    act(() => {
      startPosBtn.click();
    });

    const confirmInsertBtn = Array.from(insertDialog!.querySelectorAll<HTMLButtonElement>('button.btn--primary')).find(
      (b) => b.textContent?.includes('Вставить в главу'),
    )!;
    act(() => {
      confirmInsertBtn.click();
    });
    expect(onInsertDraftIntoChapter).toHaveBeenCalledWith('d1', 'c1', 'start');

    // 3. Удалить черновик через ConfirmDialog
    act(() => {
      menuTrigger.click();
    });

    const deleteMenuItem = Array.from(container!.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Удалить черновик'),
    )!;
    act(() => {
      deleteMenuItem.click();
    });

    // Меню закрылось, открылся ConfirmDialog (role="alertdialog")
    const alertDialog = container?.querySelector('div[role="alertdialog"]');
    expect(alertDialog).toBeTruthy();
    expect(alertDialog?.textContent).toContain('Свободная сцена и её текст будут удалены');
    expect(onDeleteDraft).not.toHaveBeenCalled();

    const confirmDeleteBtn = Array.from(alertDialog!.querySelectorAll<HTMLButtonElement>('button.btn--danger-ghost')).find(
      (b) => b.textContent?.includes('Удалить черновик'),
    )!;
    await act(async () => {
      confirmDeleteBtn.click();
    });
    expect(onDeleteDraft).toHaveBeenCalledWith('d1');
  });

  it('позволяет выбрать целевую главу и закрыть модалку без сохранения по кнопке Отмена', () => {
    const onInsertDraftIntoChapter = vi.fn();
    const chapters = [
      makeChapter('c1', 0, 'Первая глава'),
      makeChapter('c2', 1, 'Вторая глава'),
    ];
    const drafts = [makeDraft('d1', 0, 'Эпизод', 50)];

    renderSidebar({
      chapters,
      draftScenes: drafts,
      draftActions: { onInsertDraftIntoChapter },
    });

    const menuTrigger = container?.querySelector(
      'button[aria-label="Действия с черновиком: Эпизод"]',
    ) as HTMLButtonElement;
    act(() => {
      menuTrigger.click();
    });

    const insertMenuItem = Array.from(container!.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Вставить в существующую главу…'),
    )!;
    act(() => {
      insertMenuItem.click();
    });

    const insertDialog = container?.querySelector('div[role="dialog"]');
    expect(insertDialog).toBeTruthy();

    const select = insertDialog?.querySelector('select#insert-target-chapter') as HTMLSelectElement;
    expect(select).toBeTruthy();
    act(() => {
      select.value = 'c2';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Нажимаем Отмена — действие не вызывается, модалка закрывается
    const cancelBtn = Array.from(insertDialog!.querySelectorAll<HTMLButtonElement>('button.btn--ghost')).find(
      (b) => b.textContent?.includes('Отмена'),
    )!;
    act(() => {
      cancelBtn.click();
    });

    expect(onInsertDraftIntoChapter).not.toHaveBeenCalled();
  });

  it('при отсутствии глав в книге пункт «Вставить в существующую главу…» скрыт, доступна только конвертация и удаление', () => {
    const onConvertDraftToChapter = vi.fn();
    const onInsertDraftIntoChapter = vi.fn();
    const onDeleteDraft = vi.fn();
    const drafts = [makeDraft('d1', 0, 'Начало пути', 30)];

    renderSidebar({
      chapters: [],
      draftScenes: drafts,
      draftActions: {
        onConvertDraftToChapter,
        onInsertDraftIntoChapter,
        onDeleteDraft,
      },
    });

    const menuTrigger = container?.querySelector(
      'button[aria-label="Действия с черновиком: Начало пути"]',
    ) as HTMLButtonElement;
    expect(menuTrigger).toBeTruthy();
    expect(menuTrigger.getAttribute('aria-expanded')).toBe('false');
    expect(menuTrigger.getAttribute('aria-haspopup')).toBe('menu');

    act(() => {
      menuTrigger.click();
    });
    expect(menuTrigger.getAttribute('aria-expanded')).toBe('true');

    const ctxMenu = container?.querySelector('.ctx-menu');
    expect(ctxMenu).toBeTruthy();
    expect(ctxMenu?.textContent).toContain('Превратить в отдельную главу…');
    expect(ctxMenu?.textContent).not.toContain('Вставить в существующую главу…');
    expect(ctxMenu?.textContent).toContain('Удалить черновик');

    // Кликаем по «Превратить в отдельную главу…»
    const convertBtn = Array.from(ctxMenu!.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Превратить в отдельную главу…'),
    )!;
    act(() => {
      convertBtn.click();
    });

    const dialog = container?.querySelector('div[role="dialog"]');
    expect(dialog).toBeTruthy();
    // При 0 глав кнопки «После выбранной главы» нет
    expect(dialog?.textContent).not.toContain('После выбранной главы');

    // Подтверждаем конвертацию
    const confirmBtn = Array.from(dialog!.querySelectorAll<HTMLButtonElement>('button.btn--primary')).find(
      (b) => b.textContent?.includes('Превратить в главу'),
    )!;
    act(() => {
      confirmBtn.click();
    });

    expect(onConvertDraftToChapter).toHaveBeenCalledWith('d1', { mode: 'end' });
  });

  it('закрывает меню действий по нажатию Escape и возвращает фокус на кнопку вызова', () => {
    const drafts = [makeDraft('d1', 0, 'Пролог сцены', 40)];

    renderSidebar({
      chapters: [makeChapter('c1', 0, 'Глава 1')],
      draftScenes: drafts,
      draftActions: {
        onConvertDraftToChapter: vi.fn(),
      },
    });

    const menuTrigger = container?.querySelector(
      'button[aria-label="Действия с черновиком: Пролог сцены"]',
    ) as HTMLButtonElement;

    act(() => {
      menuTrigger.click();
    });
    expect(container?.querySelector('.ctx-menu')).toBeTruthy();

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(container?.querySelector('.ctx-menu')).toBeNull();
    expect(document.activeElement).toBe(menuTrigger);
  });
});
