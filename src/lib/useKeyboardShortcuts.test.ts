// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, createElement, type Dispatch, type SetStateAction } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import type { ChapterMeta } from './chapters';

type Mode = 'studio' | 'left' | 'right' | 'page';

describe('useKeyboardShortcuts', () => {
  let root: Root;
  let container: HTMLElement;
  let hookResult: ReturnType<typeof useKeyboardShortcuts>;

  const sampleChapters: ChapterMeta[] = [
    { id: 'ch-1', book_id: 'b-1', user_id: 'u-1', title: 'Глава 1', position: 0, status: 'draft', words: 100, synopsis: '', created_at: '2026-01-01', updated_at: '2026-01-01' },
    { id: 'ch-2', book_id: 'b-1', user_id: 'u-1', title: 'Глава 2', position: 1, status: 'draft', words: 200, synopsis: '', created_at: '2026-01-02', updated_at: '2026-01-02' },
    { id: 'ch-3', book_id: 'b-1', user_id: 'u-1', title: 'Глава 3', position: 2, status: 'draft', words: 300, synopsis: '', created_at: '2026-01-03', updated_at: '2026-01-03' },
  ];

  function mountHook(props: {
    onSave?: () => void;
    onCreateChapter?: () => void;
    onSelectChapter?: (id: string) => void;
    chapters?: ChapterMeta[];
    activeChapter?: ChapterMeta | null;
    isMobile?: boolean;
    isReal?: boolean;
    setMode?: Dispatch<SetStateAction<Mode>>;
    openMobileRight?: () => void;
  } = {}) {
    function Probe() {
      hookResult = useKeyboardShortcuts({
        onSave: props.onSave,
        chapterActions: {
          onCreateChapter: props.onCreateChapter,
          onSelectChapter: props.onSelectChapter,
        },
        chapters: props.chapters ?? sampleChapters,
        activeChapter: props.activeChapter !== undefined ? props.activeChapter : sampleChapters[1],
        isMobile: props.isMobile ?? false,
        isReal: props.isReal ?? true,
        setMode: props.setMode ?? vi.fn(),
        openMobileRight: props.openMobileRight ?? vi.fn(),
      });
      return null;
    }

    act(() => {
      root.render(createElement(Probe));
    });
  }

  function dispatchKey(opts: {
    code: string;
    key?: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
    target?: HTMLElement;
  }) {
    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      code: opts.code,
      key: opts.key ?? opts.code,
      ctrlKey: opts.ctrlKey ?? false,
      metaKey: opts.metaKey ?? false,
      altKey: opts.altKey ?? false,
      shiftKey: opts.shiftKey ?? false,
    });
    const target = opts.target ?? document.body;
    act(() => {
      target.dispatchEvent(event);
    });
    return event;
  }

  let originalPlatform: string;

  beforeEach(() => {
    originalPlatform = navigator.platform;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.querySelectorAll('[aria-modal="true"]').forEach((el) => el.remove());
    Object.defineProperty(navigator, 'platform', { value: originalPlatform, configurable: true });
    vi.restoreAllMocks();
  });

  describe('Ctrl + S / ⌘ S (Сохранить)', () => {
    it('вызывает onSave и preventDefault при Ctrl+S', () => {
      const onSave = vi.fn();
      mountHook({ onSave });

      const e = dispatchKey({ code: 'KeyS', ctrlKey: true });
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(e.defaultPrevented).toBe(true);
    });

    it('вызывает onSave при Cmd+S на macOS', () => {
      const originalPlatform = navigator.platform;
      Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });

      const onSave = vi.fn();
      mountHook({ onSave });

      const e = dispatchKey({ code: 'KeyS', metaKey: true });
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(e.defaultPrevented).toBe(true);

      Object.defineProperty(navigator, 'platform', { value: originalPlatform, configurable: true });
    });

    it('не вызывает onSave без модификатора', () => {
      const onSave = vi.fn();
      mountHook({ onSave });

      const e = dispatchKey({ code: 'KeyS' });
      expect(onSave).not.toHaveBeenCalled();
      expect(e.defaultPrevented).toBe(false);
    });

    it('поддерживает русскую раскладку (key="ы")', () => {
      const onSave = vi.fn();
      mountHook({ onSave });

      const e = dispatchKey({ code: 'KeyS', key: 'ы', ctrlKey: true });
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(e.defaultPrevented).toBe(true);
    });

    it('не вызывает onSave при наличии Shift или Alt', () => {
      const onSave = vi.fn();
      mountHook({ onSave });

      dispatchKey({ code: 'KeyS', ctrlKey: true, shiftKey: true });
      dispatchKey({ code: 'KeyS', ctrlKey: true, altKey: true });
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe('Ctrl + Enter / ⌘ Enter (Новая глава B-8)', () => {
    it('создаёт главу при нажатии Ctrl+Enter в редакторе (не в input)', () => {
      const onCreateChapter = vi.fn();
      mountHook({ onCreateChapter });

      const editorEl = document.createElement('div');
      editorEl.className = 'tiptap ProseMirror';
      container.appendChild(editorEl);

      const e = dispatchKey({ code: 'Enter', ctrlKey: true, target: editorEl });
      expect(onCreateChapter).toHaveBeenCalledTimes(1);
      expect(e.defaultPrevented).toBe(true);
    });

    it('создаёт главу из поля заголовка (textarea.sheet-title)', () => {
      const onCreateChapter = vi.fn();
      mountHook({ onCreateChapter });

      const titleEl = document.createElement('textarea');
      titleEl.className = 'sheet-title';
      container.appendChild(titleEl);

      const e = dispatchKey({ code: 'Enter', ctrlKey: true, target: titleEl });
      expect(onCreateChapter).toHaveBeenCalledTimes(1);
      expect(e.defaultPrevented).toBe(true);
    });

    it('поддерживает NumpadEnter для создания главы', () => {
      const onCreateChapter = vi.fn();
      mountHook({ onCreateChapter });

      const e = dispatchKey({ code: 'NumpadEnter', ctrlKey: true });
      expect(onCreateChapter).toHaveBeenCalledTimes(1);
      expect(e.defaultPrevented).toBe(true);
    });

    it('НЕ создаёт главу при нажатии в стандартном input или обычном textarea', () => {
      const onCreateChapter = vi.fn();
      mountHook({ onCreateChapter });

      const input = document.createElement('input');
      container.appendChild(input);
      dispatchKey({ code: 'Enter', ctrlKey: true, target: input });

      const otherTextarea = document.createElement('textarea');
      container.appendChild(otherTextarea);
      dispatchKey({ code: 'Enter', ctrlKey: true, target: otherTextarea });

      expect(onCreateChapter).not.toHaveBeenCalled();
    });

    it('НЕ создаёт главу, если открыто модальное окно [aria-modal="true"]', () => {
      const onCreateChapter = vi.fn();
      mountHook({ onCreateChapter });

      const modal = document.createElement('div');
      modal.setAttribute('aria-modal', 'true');
      document.body.appendChild(modal);

      dispatchKey({ code: 'Enter', ctrlKey: true });
      expect(onCreateChapter).not.toHaveBeenCalled();
    });
  });

  describe('Alt + N (Новая заметка на полях B-8)', () => {
    it('открывает форму заметки и предотвращает дефолт', () => {
      mountHook();
      expect(hookResult.showNoteForm).toBe(false);

      const e = dispatchKey({ code: 'KeyN', altKey: true });
      expect(hookResult.showNoteForm).toBe(true);
      expect(e.defaultPrevented).toBe(true);
    });

    it('на мобильных открывает правую панель (openMobileRight)', () => {
      const openMobileRight = vi.fn();
      mountHook({ isMobile: true, openMobileRight });

      dispatchKey({ code: 'KeyN', altKey: true });
      expect(openMobileRight).toHaveBeenCalledTimes(1);
      expect(hookResult.showNoteForm).toBe(true);
    });

    it('поддерживает русскую раскладку (key="т" / "Т")', () => {
      mountHook();
      dispatchKey({ code: 'KeyN', key: 'т', altKey: true });
      expect(hookResult.showNoteForm).toBe(true);
    });

    it('сбрасывает состояние через resetShowNoteForm', () => {
      mountHook();
      dispatchKey({ code: 'KeyN', altKey: true });
      expect(hookResult.showNoteForm).toBe(true);

      act(() => {
        hookResult.resetShowNoteForm();
      });
      expect(hookResult.showNoteForm).toBe(false);
    });

    it('НЕ открывает форму заметки, если фокус в поле ввода (inInput)', () => {
      mountHook();
      const input = document.createElement('input');
      container.appendChild(input);

      dispatchKey({ code: 'KeyN', altKey: true, target: input });
      expect(hookResult.showNoteForm).toBe(false);
    });

    it('НЕ открывает форму заметки, если фокус в sheet-title (textarea)', () => {
      mountHook();
      const titleEl = document.createElement('textarea');
      titleEl.className = 'sheet-title';
      container.appendChild(titleEl);

      dispatchKey({ code: 'KeyN', altKey: true, target: titleEl });
      expect(hookResult.showNoteForm).toBe(false);
    });
  });

  describe('Alt + ArrowLeft / Alt + ArrowRight (Навигация по главам B-8)', () => {
    it('Alt+ArrowLeft переключает на предыдущую главу', () => {
      const onSelectChapter = vi.fn();
      // activeChapter: index 1 (ch-2), предыдущая: ch-1
      mountHook({ onSelectChapter, activeChapter: sampleChapters[1] });

      const e = dispatchKey({ code: 'ArrowLeft', altKey: true });
      expect(onSelectChapter).toHaveBeenCalledWith('ch-1');
      expect(e.defaultPrevented).toBe(true);
    });

    it('Alt+ArrowLeft на первой главе ничего не делает', () => {
      const onSelectChapter = vi.fn();
      // activeChapter: index 0 (ch-1)
      mountHook({ onSelectChapter, activeChapter: sampleChapters[0] });

      dispatchKey({ code: 'ArrowLeft', altKey: true });
      expect(onSelectChapter).not.toHaveBeenCalled();
    });

    it('Alt+ArrowRight переключает на следующую главу', () => {
      const onSelectChapter = vi.fn();
      // activeChapter: index 1 (ch-2), следующая: ch-3
      mountHook({ onSelectChapter, activeChapter: sampleChapters[1] });

      const e = dispatchKey({ code: 'ArrowRight', altKey: true });
      expect(onSelectChapter).toHaveBeenCalledWith('ch-3');
      expect(e.defaultPrevented).toBe(true);
    });

    it('Alt+ArrowRight на последней главе ничего не делает', () => {
      const onSelectChapter = vi.fn();
      // activeChapter: index 2 (ch-3, последняя)
      mountHook({ onSelectChapter, activeChapter: sampleChapters[2] });

      dispatchKey({ code: 'ArrowRight', altKey: true });
      expect(onSelectChapter).not.toHaveBeenCalled();
    });

    it('НЕ переключает главы, если фокус в input или sheet-title', () => {
      const onSelectChapter = vi.fn();
      mountHook({ onSelectChapter, activeChapter: sampleChapters[1] });

      const input = document.createElement('input');
      container.appendChild(input);

      dispatchKey({ code: 'ArrowLeft', altKey: true, target: input });
      dispatchKey({ code: 'ArrowRight', altKey: true, target: input });
      expect(onSelectChapter).not.toHaveBeenCalled();

      const titleEl = document.createElement('textarea');
      titleEl.className = 'sheet-title';
      container.appendChild(titleEl);

      dispatchKey({ code: 'ArrowLeft', altKey: true, target: titleEl });
      dispatchKey({ code: 'ArrowRight', altKey: true, target: titleEl });
      expect(onSelectChapter).not.toHaveBeenCalled();
    });

    it('на macOS НЕ переключает главы, если фокус внутри contenteditable (сохраняет навигацию по словам)', () => {
      Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });

      const onSelectChapter = vi.fn();
      mountHook({ onSelectChapter, activeChapter: sampleChapters[1] });

      const editorEl = document.createElement('div');
      editorEl.setAttribute('contenteditable', 'true');
      editorEl.className = 'tiptap ProseMirror';
      container.appendChild(editorEl);

      const p = document.createElement('p');
      editorEl.appendChild(p);

      const eLeft = dispatchKey({ code: 'ArrowLeft', altKey: true, target: p });
      const eRight = dispatchKey({ code: 'ArrowRight', altKey: true, target: p });

      expect(onSelectChapter).not.toHaveBeenCalled();
      expect(eLeft.defaultPrevented).toBe(false);
      expect(eRight.defaultPrevented).toBe(false);
    });

    it('на macOS переключает главы, если фокус вне текста (например, на body или кнопке)', () => {
      Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });

      const onSelectChapter = vi.fn();
      mountHook({ onSelectChapter, activeChapter: sampleChapters[1] });

      const btn = document.createElement('button');
      container.appendChild(btn);

      const e = dispatchKey({ code: 'ArrowLeft', altKey: true, target: btn });
      expect(onSelectChapter).toHaveBeenCalledWith('ch-1');
      expect(e.defaultPrevented).toBe(true);
    });

    it('на Windows переключает главы даже из редактора (где Alt+стрелки свободны от навигации по словам)', () => {
      Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true });

      const onSelectChapter = vi.fn();
      mountHook({ onSelectChapter, activeChapter: sampleChapters[1] });

      const editorEl = document.createElement('div');
      editorEl.setAttribute('contenteditable', 'true');
      editorEl.className = 'tiptap ProseMirror';
      container.appendChild(editorEl);

      const e = dispatchKey({ code: 'ArrowLeft', altKey: true, target: editorEl });
      expect(onSelectChapter).toHaveBeenCalledWith('ch-1');
      expect(e.defaultPrevented).toBe(true);
    });
  });

  describe('Ctrl + Shift + F (Режим страницы)', () => {
    it('переключает режим setMode', () => {
      const setMode = vi.fn();
      mountHook({ setMode });

      const e = dispatchKey({ code: 'KeyF', ctrlKey: true, shiftKey: true });
      expect(setMode).toHaveBeenCalledTimes(1);
      expect(e.defaultPrevented).toBe(true);

      // Проверяем toggle функцию:
      const updater = setMode.mock.calls[0][0];
      expect(updater('studio')).toBe('page');
      expect(updater('page')).toBe('studio');
    });

    it('НЕ переключает режим, если фокус в input или sheet-title', () => {
      const setMode = vi.fn();
      mountHook({ setMode });

      const input = document.createElement('input');
      container.appendChild(input);

      dispatchKey({ code: 'KeyF', ctrlKey: true, shiftKey: true, target: input });
      expect(setMode).not.toHaveBeenCalled();

      const titleEl = document.createElement('textarea');
      titleEl.className = 'sheet-title';
      container.appendChild(titleEl);

      dispatchKey({ code: 'KeyF', ctrlKey: true, shiftKey: true, target: titleEl });
      expect(setMode).not.toHaveBeenCalled();
    });
  });

  describe('isReal = false', () => {
    it('игнорирует все шорткаты, если книга не реальная (демо/сэмпл)', () => {
      const onSave = vi.fn();
      const onCreateChapter = vi.fn();
      const onSelectChapter = vi.fn();
      mountHook({
        isReal: false,
        onSave,
        onCreateChapter,
        onSelectChapter,
      });

      dispatchKey({ code: 'KeyS', ctrlKey: true });
      dispatchKey({ code: 'Enter', ctrlKey: true });
      dispatchKey({ code: 'ArrowLeft', altKey: true });
      dispatchKey({ code: 'KeyN', altKey: true });

      expect(onSave).not.toHaveBeenCalled();
      expect(onCreateChapter).not.toHaveBeenCalled();
      expect(onSelectChapter).not.toHaveBeenCalled();
      expect(hookResult.showNoteForm).toBe(false);
    });
  });
});
