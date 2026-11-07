// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DraftSceneBridgeBar, DraftSceneSheet } from './EditorHybrid';
import type { DraftScene } from '../lib/draftScenes';
import type { ChapterMeta } from '../lib/chapters';

vi.mock('./RichEditor', () => ({
  RichEditor: ({ className, placeholder }: { className?: string; placeholder?: string }) => (
    <div data-testid="mock-rich-editor" className={className} data-placeholder={placeholder} />
  ),
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function mount(element: React.ReactElement): HTMLDivElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(element);
  });
  return container;
}

afterEach(() => {
  if (root) {
    act(() => {
      root!.unmount();
    });
  }
  if (container?.parentNode) {
    container.parentNode.removeChild(container);
  }
  container = null;
  root = null;
  document.body.innerHTML = '';
});

const mockScene: DraftScene = {
  id: 'draft-1',
  book_id: 'book-1',
  user_id: 'user-1',
  title: 'Сцена 1',
  content: '<p>Текст черновика сцены.</p>',
  words: 42,
  position: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockChapters: ChapterMeta[] = [
  {
    id: 'ch-1',
    book_id: 'book-1',
    user_id: 'user-1',
    title: 'Глава 1',
    position: 0,
    words: 1200,
    status: 'draft',
    synopsis: '',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'ch-2',
    book_id: 'book-1',
    user_id: 'user-1',
    title: 'Глава 2',
    position: 1,
    words: 950,
    status: 'draft',
    synopsis: '',
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  },
];

describe('DraftSceneBridgeBar — компактная элегантная панель и модальные окна', () => {
  it('рендерит компактный статус-бар с количеством слов и кнопками действий', () => {
    mount(
      <DraftSceneBridgeBar
        scene={mockScene}
        chapters={mockChapters}
        draftActions={{
          onConvertDraftToChapter: vi.fn(),
          onInsertDraftIntoChapter: vi.fn(),
          onDeleteDraft: vi.fn(),
        }}
      />,
    );

    const banner = document.querySelector('.draft-scene-banner');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('Свободная сцена');
    expect(banner?.textContent).toContain('42 слова');

    // Кнопки действий присутствуют
    const buttons = Array.from(banner?.querySelectorAll('button') ?? []);
    const buttonTexts = buttons.map((b) => b.textContent?.trim());
    expect(buttonTexts).toContain('Превратить в главу');
    expect(buttonTexts).toContain('Вставить в существующую главу');
    expect(buttonTexts).toContain('Удалить');

    // Внутри баннера НЕТ встроенной громоздкой панели .draft-scene-banner__panel
    expect(document.querySelector('.draft-scene-banner__panel')).toBeNull();
  });

  it('клик по «Превратить в главу» открывает модальное окно вместо раздвигания инлайн-панели', () => {
    const onConvert = vi.fn();
    mount(
      <DraftSceneBridgeBar
        scene={mockScene}
        chapters={mockChapters}
        draftActions={{
          onConvertDraftToChapter: onConvert,
        }}
      />,
    );

    // До клика модалки нет
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    // Кликаем «Превратить в главу»
    const convertBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Превратить в главу'),
    );
    expect(convertBtn).toBeDefined();
    act(() => {
      convertBtn?.click();
    });

    // Открылось модальное окно диалога
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Превратить сцену в главу');
    expect(dialog?.textContent).toContain('В конец книги');
    expect(dialog?.textContent).toContain('В начало книги');
    expect(dialog?.textContent).toContain('После выбранной главы');

    // Нажатие на «Отмена» закрывает модалку без вызова onConvert
    const cancelBtn = Array.from(dialog?.querySelectorAll('button') ?? []).find((b) =>
      b.textContent?.trim() === 'Отмена',
    );
    act(() => {
      cancelBtn?.click();
    });
    expect(onConvert).not.toHaveBeenCalled();
  });

  it('в модальном окне выбор «После выбранной главы» показывает выпадающий список и передает placement', () => {
    const onConvert = vi.fn();
    mount(
      <DraftSceneBridgeBar
        scene={mockScene}
        chapters={mockChapters}
        draftActions={{
          onConvertDraftToChapter: onConvert,
        }}
      />,
    );

    const convertBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Превратить в главу'),
    );
    act(() => {
      convertBtn?.click();
    });

    const dialog = document.querySelector('[role="dialog"]')!;
    const afterBtn = Array.from(dialog.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('После выбранной главы'),
    );
    expect(afterBtn).toBeDefined();

    act(() => {
      afterBtn?.click();
    });

    // Появился селект с главами
    const select = dialog.querySelector<HTMLSelectElement>('select');
    expect(select).not.toBeNull();
    expect(select?.value).toBe('ch-2');

    // Меняем выбор на ch-1
    act(() => {
      select!.value = 'ch-1';
      select!.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Подтверждаем
    const submitBtn = Array.from(dialog.querySelectorAll('button')).find((b) =>
      b.classList.contains('btn--primary'),
    );
    act(() => {
      submitBtn?.click();
    });

    expect(onConvert).toHaveBeenCalledWith('draft-1', {
      mode: 'after',
      afterChapterId: 'ch-1',
    });
  });

  it('клик по «Вставить в существующую главу» открывает диалог вставки', () => {
    const onInsert = vi.fn();
    mount(
      <DraftSceneBridgeBar
        scene={mockScene}
        chapters={mockChapters}
        draftActions={{
          onInsertDraftIntoChapter: onInsert,
        }}
      />,
    );

    const insertBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Вставить в существующую главу'),
    );
    act(() => {
      insertBtn?.click();
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Вставить в существующую главу');
    expect(dialog?.textContent).toContain('Целевая глава:');
    expect(dialog?.textContent).toContain('Дописать в конец');
    expect(dialog?.textContent).toContain('Вставить в начало');

    // Переключаем на «Вставить в начало»
    const startPosBtn = Array.from(dialog!.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Вставить в начало'),
    );
    act(() => {
      startPosBtn?.click();
    });

    const submitBtn = Array.from(dialog!.querySelectorAll('button')).find((b) =>
      b.classList.contains('btn--primary'),
    );
    act(() => {
      submitBtn?.click();
    });

    expect(onInsert).toHaveBeenCalledWith('draft-1', 'ch-1', 'start');
  });

  it('клик по «Удалить» открывает диалог подтверждения удаления', () => {
    const onDelete = vi.fn();
    mount(
      <DraftSceneBridgeBar
        scene={mockScene}
        chapters={mockChapters}
        draftActions={{
          onDeleteDraft: onDelete,
        }}
      />,
    );

    const deleteBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Удалить'),
    );
    act(() => {
      deleteBtn?.click();
    });

    const dialog = document.querySelector('[role="alertdialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Свободная сцена и её текст будут удалены');

    const confirmBtn = Array.from(dialog!.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Удалить черновик'),
    );
    act(() => {
      confirmBtn?.click();
    });

    expect(onDelete).toHaveBeenCalledWith('draft-1');
  });

  it('повторное открытие модалки конвертации сбрасывает режим в дефолтный «В конец книги»', () => {
    mount(
      <DraftSceneBridgeBar
        scene={mockScene}
        chapters={mockChapters}
        draftActions={{
          onConvertDraftToChapter: vi.fn(),
        }}
      />,
    );

    const convertBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Превратить в главу'),
    )!;

    // Первое открытие: переключаем на «В начало книги»
    act(() => { convertBtn.click(); });
    const dialog1 = document.querySelector('[role="dialog"]')!;
    const startBtn = Array.from(dialog1.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('В начало книги'),
    )!;
    act(() => { startBtn.click(); });

    // Закрываем модалку
    const cancelBtn = Array.from(dialog1.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'Отмена',
    )!;
    act(() => { cancelBtn.click(); });

    // Открываем снова: режим должен быть снова «В конец книги»
    act(() => { convertBtn.click(); });
    const dialog2 = document.querySelector('[role="dialog"]')!;
    const endBtn = Array.from(dialog2.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('В конец книги'),
    )!;
    expect(endBtn.className).toContain('draft-scene-banner__seg-btn--on');
  });
});

describe('DraftSceneSheet — чистота листа рукописи и отсутствие громоздких панелей', () => {
  it('рендерит панель черновика вне листа рукописи .sheet, сохраняя лист чистым', () => {
    mount(
      <DraftSceneSheet
        scene={mockScene}
        chapters={mockChapters}
        onContentChange={vi.fn()}
        onTitleChange={vi.fn()}
        onEditor={vi.fn()}
        width={760}
        padding="56px 72px 80px"
      />,
    );

    const containerEl = document.querySelector('.draft-scene-container');
    expect(containerEl).not.toBeNull();

    // Панель черновика находится в контейнере над листом
    const banner = containerEl?.querySelector('.draft-scene-banner');
    expect(banner).not.toBeNull();

    // Внутри листа .sheet НЕТ панели .draft-scene-banner
    const sheet = containerEl?.querySelector('.sheet');
    expect(sheet).not.toBeNull();
    expect(sheet?.querySelector('.draft-scene-banner')).toBeNull();

    // Лист рукописи начинается сразу с поля заголовка
    const textarea = sheet?.querySelector<HTMLTextAreaElement>('textarea.sheet-title');
    expect(textarea).not.toBeNull();
    expect(textarea?.placeholder).toBe('Название сцены или фрагмента');
    expect(textarea?.value).toBe('Сцена 1');
  });
});
