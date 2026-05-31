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
  const [openNoteAt, setOpenNoteAt] = useState(0);

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
      const mod = /mac/i.test(navigator.platform) ? e.metaKey : e.ctrlKey;
      if (!mod) return;

      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA';

      if (e.code === 'KeyS' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        onSaveRef.current?.();
      } else if (!inInput) {
        if (e.code === 'Enter' && !e.shiftKey && !e.altKey) {
          e.preventDefault();
          chapterActionsRef.current?.onCreateChapter?.();
        } else if (e.code === 'BracketLeft' && e.shiftKey && !e.altKey) {
          e.preventDefault();
          const chs = chaptersRef.current;
          const ac = activeChapterRef.current;
          if (chs && ac) {
            const idx = chs.findIndex((c) => c.id === ac.id);
            if (idx > 0) chapterActionsRef.current?.onSelectChapter?.(chs[idx - 1].id);
          }
        } else if (e.code === 'BracketRight' && e.shiftKey && !e.altKey) {
          e.preventDefault();
          const chs = chaptersRef.current;
          const ac = activeChapterRef.current;
          if (chs && ac) {
            const idx = chs.findIndex((c) => c.id === ac.id);
            if (idx !== -1 && idx < chs.length - 1) chapterActionsRef.current?.onSelectChapter?.(chs[idx + 1].id);
          }
        } else if (e.code === 'KeyF' && e.shiftKey && !e.altKey) {
          e.preventDefault();
          setMode((prev) => (prev === 'page' ? 'studio' : 'page'));
        } else if (e.code === 'KeyN' && e.shiftKey && !e.altKey) {
          e.preventDefault();
          if (isMobileRef.current) openMobileRight();
          setOpenNoteAt((prev) => prev + 1);
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [setMode, openMobileRight]);

  return { openNoteAt };
}
