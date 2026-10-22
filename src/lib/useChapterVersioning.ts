import { useCallback, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';
import { countWords } from './chapters';
import { createVersion, createVersionKeepAlive } from './versions';

const SNAPSHOT_KEEPALIVE_MAX = 24_000;

export function useChapterVersioning({
  chapterId,
  userId,
  isPro,
  onVersionCreated,
}: {
  chapterId: string | null | undefined;
  userId: string | undefined;
  isPro: boolean;
  onVersionCreated?: () => void;
}) {
  // Latest-value refs — sync-updated each render, safe to read inside callbacks/intervals
  const chapterIdRef = useRef(chapterId);
  chapterIdRef.current = chapterId;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const onVersionCreatedRef = useRef(onVersionCreated);
  onVersionCreatedRef.current = onVersionCreated;

  const sessionTokenRef = useRef<string | null>(null);
  const currentContentRef = useRef<string>('');
  const lastVersionContentRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) sessionTokenRef.current = data.session?.access_token ?? null;
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      sessionTokenRef.current = session?.access_token ?? null;
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!chapterId || !userId) return;
    const intervalMs = isPro ? 30 * 60_000 : 2 * 60 * 60_000;
    const id = setInterval(() => {
      const cId = chapterIdRef.current;
      const uId = userIdRef.current;
      const content = currentContentRef.current;
      if (!cId || !uId || !content) return;
      if (lastVersionContentRef.current.get(cId) === content) return;
      lastVersionContentRef.current.set(cId, content);
      void createVersion(cId, uId, content, countWords(content), 'timer')
        .then(() => onVersionCreatedRef.current?.());
    }, intervalMs);
    return () => clearInterval(id);
  }, [chapterId, userId, isPro]);

  // Updates currentContentRef and sets snapshot baseline on first load for this chapter
  const onContentTracked = useCallback((content: string) => {
    currentContentRef.current = content;
    const cId = chapterIdRef.current;
    if (cId && content && !lastVersionContentRef.current.has(cId)) {
      lastVersionContentRef.current.set(cId, content);
    }
  }, []);

  // Call when switching away from prevChapterId (after flushing autosave)
  const onChapterSwitch = useCallback((prevChapterId: string) => {
    const uId = userIdRef.current;
    const content = currentContentRef.current;
    if (!uId || !content) return;
    if (lastVersionContentRef.current.get(prevChapterId) !== content) {
      lastVersionContentRef.current.set(prevChapterId, content);
      void createVersion(prevChapterId, uId, content, countWords(content), 'chapter_switch')
        .then(() => onVersionCreatedRef.current?.());
    }
  }, []);

  // Keepalive-снимок при закрытии вкладки. Лимит keepalive (64 КиБ) общий с сохранением
  // самой главы (useChapterAutosave), поэтому снимок шлём только для небольших глав —
  // текст главы в любом случае страхует локальный черновик.
  // createVersionKeepAlive uses raw fetch — no server-side dedup, so we guard here.
  useEffect(() => {
    const onBeforeUnload = () => {
      const cId = chapterIdRef.current;
      const uId = userIdRef.current;
      const content = currentContentRef.current;
      const token = sessionTokenRef.current;
      if (!cId || !uId || !content || !token) return;
      if (content.length * 2 > SNAPSHOT_KEEPALIVE_MAX) return;
      if (lastVersionContentRef.current.get(cId) === content) return;
      createVersionKeepAlive(cId, uId, content, countWords(content), SUPABASE_URL, SUPABASE_ANON_KEY, token);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  return { currentContentRef, onContentTracked, onChapterSwitch };
}
