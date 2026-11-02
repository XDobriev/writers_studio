// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ImportManuscriptModal } from './ImportManuscriptModal';
import type { useManuscriptImport } from '../lib/useManuscriptImport';

type MockImp = ReturnType<typeof useManuscriptImport>;

let mockImpState: Partial<MockImp> = {};

vi.mock('../lib/useManuscriptImport', () => ({
  useManuscriptImport: () => mockImpState,
}));

let root: Root | null = null;
function mount(props?: { isOpen?: boolean; onClose?: () => void }): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => {
    root!.render(
      createElement(ImportManuscriptModal, {
        isOpen: props?.isOpen ?? true,
        onClose: props?.onClose ?? vi.fn(),
        userId: 'test-user-id',
        isPro: true,
        cover: '#1a1a22',
        onNeedUpgrade: vi.fn(),
      }),
    );
  });
  return el;
}

afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('ImportManuscriptModal', () => {
  beforeEach(() => {
    mockImpState = {
      state: { kind: 'idle' },
      title: '',
      setTitle: vi.fn(),
      chapters: [],
      error: null,
      clearError: vi.fn(),
      loadFile: vi.fn(),
      setMode: vi.fn(),
      joinWithPrevious: vi.fn(),
      unjoin: vi.fn(),
      mergeWithPrevious: vi.fn(),
      splitChapterAtParagraph: vi.fn(),
      splitChapterAtOffset: vi.fn(),
      create: vi.fn(),
      reset: vi.fn(),
    };
  });

  it('не рендерит ничего, когда isOpen = false', () => {
    const el = mount({ isOpen: false });
    expect(el.innerHTML).toBe('');
  });

  it('рендерит диалог импорта рукописи с корректными a11y атрибутами', () => {
    const el = mount({ isOpen: true });
    const dialog = el.querySelector('[role="dialog"]')!;
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-label')).toBe('Импорт рукописи');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('в режиме предпросмотра отображает список глав с кнопками склейки и разрезки', () => {
    const mergeWithPrevious = vi.fn();
    const splitChapterAtParagraph = vi.fn();

    mockImpState = {
      ...mockImpState,
      state: {
        kind: 'preview',
        parsed: {
          format: 'docx',
          title: 'Книга',
          author: 'Автор',
          units: [],
          images: new Map(),
        },
        options: [
          { mode: 'headings', count: 2 },
          { mode: 'pattern', count: 2 },
          { mode: 'single', count: 1 },
        ],
        mode: 'headings',
        joins: [],
      },
      title: 'Книга',
      chapters: [
        {
          title: 'Глава 1',
          html: '<p>Первый абзац первой главы.</p><p>Второй абзац первой главы.</p>',
          words: 8,
        },
        {
          title: 'Глава 2',
          html: '<p>Первый абзац второй главы.</p><p>Второй абзац второй главы.</p>',
          words: 8,
        },
      ],
      mergeWithPrevious,
      splitChapterAtParagraph,
    };

    const el = mount({ isOpen: true });

    // Первая глава: нет кнопки «Объединить с предыдущей», но есть «Разрезать…»
    const splitBtns = el.querySelectorAll<HTMLButtonElement>('button[title="Разрезать главу"]');
    expect(splitBtns).toHaveLength(2);
    expect(splitBtns[0].getAttribute('aria-expanded')).toBe('false');

    // Вторая глава: есть кнопка «↑ Объединить с предыдущей»
    const mergeBtn = el.querySelector<HTMLButtonElement>(
      'button[aria-label="Объединить главу «Глава 2» с предыдущей"]',
    );
    expect(mergeBtn).toBeTruthy();

    // Клик по «↑ Объединить с предыдущей» вызывает mergeWithPrevious(1)
    act(() => {
      mergeBtn!.click();
    });
    expect(mergeWithPrevious).toHaveBeenCalledWith(1);

    // Клик по «Разрезать…» первой главы раскрывает панель разрезки
    act(() => {
      splitBtns[0].click();
    });
    expect(splitBtns[0].getAttribute('aria-expanded')).toBe('true');
    expect(splitBtns[0].textContent).toBe('Свернуть');

    // Панель разрезки отображает кнопку «✂ Разрезать здесь»
    const cutBtn = el.querySelector<HTMLButtonElement>(
      'button[aria-label="Разрезать здесь перед абзацем 2"]',
    );
    expect(cutBtn).toBeTruthy();

    // Клик по «✂ Разрезать здесь» вызывает splitChapterAtParagraph(0, 1)
    act(() => {
      cutBtn!.click();
    });
    expect(splitChapterAtParagraph).toHaveBeenCalledWith(0, 1);
  });

  it('поддерживает разрезку главы из одного абзаца пополам', () => {
    const splitChapterAtOffset = vi.fn();

    mockImpState = {
      ...mockImpState,
      state: {
        kind: 'preview',
        parsed: {
          format: 'docx',
          title: 'Книга',
          author: '',
          units: [],
          images: new Map(),
        },
        options: [{ mode: 'single', count: 1 }],
        mode: 'single',
        joins: [],
      },
      title: 'Книга',
      chapters: [
        {
          title: 'Длинная глава',
          html: '<p>Сплошной длинный текст без деления на абзацы внутри главы.</p>',
          words: 9,
        },
      ],
      splitChapterAtOffset,
    };

    const el = mount({ isOpen: true });
    const splitBtn = el.querySelector<HTMLButtonElement>('button[title="Разрезать главу"]')!;

    act(() => {
      splitBtn.click();
    });

    const halfCutBtn = el.querySelector<HTMLButtonElement>(
      'button[aria-label="Разрезать здесь главу «Длинная глава»"]',
    );
    expect(halfCutBtn).toBeTruthy();

    act(() => {
      halfCutBtn!.click();
    });
    expect(splitChapterAtOffset).toHaveBeenCalled();
  });
});
