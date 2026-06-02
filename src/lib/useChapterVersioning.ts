import { useCallback, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { countWords } from './chapters';
import { createVersion, createVersionKeepAlive } from './versions';

export function useChapterVersioning({
  chapterId,
  userId,
  isPro,
}: {
  chapterId: string | null | undefined;
  userId: string | undefined;
  isPro: boolean;
}) {
  // Latest-value refs — sync-updated each render, safe to read inside callbacks/intervals
  const chapterIdRef = useRef(chapterId);
  chapterIdRef.current = chapterId;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const isProRef = useRef(isPro);
  isProRef.current = isPro;

  const sessionTokenRef = useRef<string | null>(null);
  const currentContentRef = useRef<string>('');
  const lastVersionContentRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      sessionTokenRef.current = data.session?.access_token ?? null;
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      sessionTokenRef.current = session?.access_token ?? null;
    });
    return () => subscription.unsubscribe();
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
      void createVersion(cId, uId, content, countWords(content), 'timer', isProRef.current);
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
      void createVersion(prevChapterId, uId, content, countWords(content), 'chapter_switch', isProRef.current);
    }
  }, []);

  // Call inside beforeunload handler for version keepalive.
  // createVersionKeepAlive uses raw fetch — no server-side dedup, so we guard here.
  const onBeforeUnload = useCallback(() => {
    const cId = chapterIdRef.current;
    const uId = userIdRef.current;
    const content = currentContentRef.current;
    const token = sessionTokenRef.current;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    if (cId && uId && content && token && lastVersionContentRef.current.get(cId) !== content) {
      createVersionKeepAlive(cId, uId, content, countWords(content), supabaseUrl, anonKey, token);
    }
  }, []);

  return { currentContentRef, onContentTracked, onChapterSwitch, onBeforeUnload };
}
