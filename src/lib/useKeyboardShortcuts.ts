import { useState, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ChapterMeta, ChapterActions } from './chapters';

type Mode = 'studio' | 'left' | 'right' | 'page';

interface UseKeyboardShortcutsParams {
  onSave?: () => void;
  chapterActions?: ChapterActions;
  chapters?: ChapterMeta[];
  activeChapter?: ChapterMeta | null;
  isMobile: boolean;
  isReal: boolean;
  setMode: Dispatch<SetStateAction<Mode>>;
  openMobileRight: () => void;
}

export function useKeyboardShortcuts({
  onSave,
  chapterActions,
  chapters,
  activeChapter,
  isMobile,
  isReal,
  setMode,
  openMobileRight,
}: UseKeyboardShortcutsParams) {
  const [showNoteForm, setShowNoteForm] = useState(false);

  const onSaveRef = useRef(onSave);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);
  const chapterActionsRef = useRef(chapterActions);
  useEffect(() => { chapterActionsRef.current = chapterActions; }, [chapterActions]);
  const chaptersRef = useRef(chapters);
  useEffect(() => { chaptersRef.current = chapters; }, [chapters]);
  const activeChapterRef = useRef(activeChapter);
  useEffect(() => { activeChapterRef.current = activeChapter; }, [activeChapter]);
  const isMobileRef = useRef(false);
  const isRealRef = useRef(false);
  useEffect(() => { isMobileRef.current = isMobile; }, [isMobile]);
  useEffect(() => { isRealRef.current = isReal; }, [isReal]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isRealRef.current) return;

      // Открытая модалка (версия главы, настройки…) — горячие клавиши редактора под ней запрещены.
      const inModal = document.querySelector('[aria-modal="true"]') !== null;
      if (inModal) return;

      const target = e.target as HTMLElement | null;
      const isSheetTitle = Boolean(target?.classList?.contains('sheet-title'));
      const inInput = Boolean(
        target && (
          target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA'
        )
      );

      const isMac = typeof navigator !== 'undefined' && (/mac/i.test(navigator.platform) || /mac/i.test(navigator.userAgent));
      const mod = isMac ? e.metaKey : e.ctrlKey;
      const isKeyS = e.code === 'KeyS' || e.key?.toLowerCase() === 's' || e.key?.toLowerCase() === 'ы';

      if (mod && isKeyS && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        onSaveRef.current?.();
      } else if (mod && (e.code === 'Enter' || e.code === 'NumpadEnter' || e.key === 'Enter') && !e.shiftKey && !e.altKey) {
        // Создание главы разрешено из редактора и из поля названия главы (sheet-title),
        // но заблокировано в остальных полях ввода.
        if (!inInput || isSheetTitle) {
          e.preventDefault();
          chapterActionsRef.current?.onCreateChapter?.();
        }
      } else if (e.altKey && !mod && !e.shiftKey && (e.code === 'ArrowLeft' || e.key === 'ArrowLeft')) {
        // На macOS Option+ArrowLeft — нативная навигация по словам в тексте. Внутри contenteditable/ProseMirror не перехватываем.
        const isMacContentEditable = isMac && Boolean(
          target && (
            target.isContentEditable ||
            target.closest?.('.tiptap, .ProseMirror, [contenteditable="true"], [contenteditable=""]')
          )
        );
        if (!inInput && !isMacContentEditable) {
          e.preventDefault();
          const chs = chaptersRef.current;
          const ac = activeChapterRef.current;
          if (chs && ac) {
            const idx = chs.findIndex((c) => c.id === ac.id);
            if (idx > 0) chapterActionsRef.current?.onSelectChapter?.(chs[idx - 1].id);
          }
        }
      } else if (e.altKey && !mod && !e.shiftKey && (e.code === 'ArrowRight' || e.key === 'ArrowRight')) {
        // На macOS Option+ArrowRight — нативная навигация по словам в тексте. Внутри contenteditable/ProseMirror не перехватываем.
        const isMacContentEditable = isMac && Boolean(
          target && (
            target.isContentEditable ||
            target.closest?.('.tiptap, .ProseMirror, [contenteditable="true"], [contenteditable=""]')
          )
        );
        if (!inInput && !isMacContentEditable) {
          e.preventDefault();
          const chs = chaptersRef.current;
          const ac = activeChapterRef.current;
          if (chs && ac) {
            const idx = chs.findIndex((c) => c.id === ac.id);
            if (idx !== -1 && idx < chs.length - 1) chapterActionsRef.current?.onSelectChapter?.(chs[idx + 1].id);
          }
        }
      } else if (mod && e.code === 'KeyF' && e.shiftKey && !e.altKey) {
        if (!inInput) {
          e.preventDefault();
          setMode((prev) => (prev === 'page' ? 'studio' : 'page'));
        }
      } else if (e.altKey && !mod && !e.shiftKey && (e.code === 'KeyN' || e.key?.toLowerCase() === 'n' || e.key?.toLowerCase() === 'т')) {
        if (!inInput) {
          e.preventDefault();
          if (isMobileRef.current) openMobileRight();
          setShowNoteForm(true);
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [setMode, openMobileRight]);

  const resetShowNoteForm = () => setShowNoteForm(false);

  return { showNoteForm, resetShowNoteForm };
}
