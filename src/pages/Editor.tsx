import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams, Navigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { EditorHybrid } from '../components/EditorHybrid';
import { useAuth } from '../lib/auth';
import { type Book } from '../lib/supabase';
import { updateBook } from '../lib/books';
import {
  countWords,
  createChapter,
  deleteChapter,
  updateChapter,
  type Chapter,
  type ChapterPatch,
  type ChapterStatus,
} from '../lib/chapters';
import { QUERY_KEYS, useBook, useChapters } from '../lib/queries';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function Editor() {
  const { id: bookId } = useParams<{ id: string }>();
  const [search, setSearch] = useSearchParams();
  const { user } = useAuth();

  const queryClient = useQueryClient();
  const { data: book, error: bookError } = useBook(bookId);
  const { data: chapters, error: chaptersError } = useChapters(bookId);
  const [mutationError, setError] = useState<string | null>(null);
  const error = (bookError ?? chaptersError)?.message ?? mutationError;
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const activeId = search.get('chapter');

  useEffect(() => {
    if (!chapters || chapters.length === 0) return;
    const exists = activeId && chapters.some((c) => c.id === activeId);
    if (!exists) {
      const next = new URLSearchParams(search);
      next.set('chapter', chapters[0].id);
      setSearch(next, { replace: true });
    }
  }, [chapters, activeId, search, setSearch]);

  const activeChapter = useMemo(
    () => (chapters && activeId ? chapters.find((c) => c.id === activeId) ?? null : null),
    [chapters, activeId],
  );

  const selectChapter = useCallback((id: string) => {
    const next = new URLSearchParams(search);
    next.set('chapter', id);
    setSearch(next, { replace: false });
  }, [search, setSearch]);

  const onCreateChapter = useCallback(async () => {
    if (!bookId || !user) return;
    const position = (chapters?.length ?? 0);
    try {
      const created = await createChapter(bookId, user.id, {
        title: `Глава ${position + 1}`,
        position,
      });
      queryClient.setQueryData<Chapter[]>(QUERY_KEYS.chapters(bookId!), (prev) => [...(prev ?? []), created]);
      const next = new URLSearchParams(search);
      next.set('chapter', created.id);
      setSearch(next, { replace: false });
    } catch (e) {
      setError((e as Error).message);
    }
  }, [bookId, user, chapters, queryClient, search, setSearch]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatch = useRef<ChapterPatch | null>(null);
  const targetIdRef = useRef<string | null>(null);

  const flush = useCallback(async () => {
    const patch = pendingPatch.current;
    const id = targetIdRef.current;
    pendingPatch.current = null;
    if (!patch || !id || !bookId) return;
    setSaveState('saving');
    try {
      const updated = await updateChapter(id, patch);
      queryClient.setQueryData<Chapter[]>(QUERY_KEYS.chapters(bookId), (prev) =>
        prev ? prev.map((c) => (c.id === id ? updated : c)) : prev
      );
      setSaveState('saved');
      setSavedAt(new Date());
    } catch {
      setSaveState('error');
    }
  }, [bookId, queryClient]);

  const scheduleSave = useCallback((id: string, patch: ChapterPatch) => {
    targetIdRef.current = id;
    pendingPatch.current = { ...(pendingPatch.current ?? {}), ...patch };
    if (bookId) {
      queryClient.setQueryData<Chapter[]>(QUERY_KEYS.chapters(bookId), (prev) =>
        prev ? prev.map((c) => (c.id === id ? { ...c, ...patch } as Chapter : c)) : prev
      );
    }
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void flush(); }, 700);
  }, [flush, bookId, queryClient]);

  const lastActiveIdRef = useRef<string | null>(null);
  useEffect(() => {
    const newId = activeChapter?.id ?? null;
    if (lastActiveIdRef.current && lastActiveIdRef.current !== newId) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      void flush();
    }
    lastActiveIdRef.current = newId;
  }, [activeChapter, flush]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    void flush();
  }, [flush]);

  const onContentChange = useCallback((html: string) => {
    if (!activeChapter) return;
    scheduleSave(activeChapter.id, { content: html, words: countWords(html) });
  }, [activeChapter, scheduleSave]);

  const onTitleChange = useCallback((title: string) => {
    if (!activeChapter) return;
    scheduleSave(activeChapter.id, { title });
  }, [activeChapter, scheduleSave]);

  const onStatusChange = useCallback(async (id: string, status: ChapterStatus) => {
    if (bookId) {
      queryClient.setQueryData<Chapter[]>(QUERY_KEYS.chapters(bookId), (prev) =>
        prev ? prev.map((c) => (c.id === id ? { ...c, status } : c)) : prev
      );
    }
    await updateChapter(id, { status }).catch(() => {
      if (bookId) void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapters(bookId) });
    });
  }, [bookId, queryClient]);

  const onGoalChange = useCallback(async (goal: number) => {
    if (!bookId) return;
    queryClient.setQueryData<Book>(QUERY_KEYS.book(bookId), (prev) =>
      prev ? { ...prev, daily_goal: goal } : prev
    );
    await updateBook(bookId, { daily_goal: goal });
  }, [bookId, queryClient]);

  const onDeleteChapter = useCallback(async (id: string) => {
    try {
      await deleteChapter(id);
      const remaining = (chapters ?? []).filter((c) => c.id !== id);
      if (bookId) {
        queryClient.setQueryData<Chapter[]>(QUERY_KEYS.chapters(bookId), remaining);
      }
      if (id === activeId && remaining.length > 0) {
        const next = new URLSearchParams(search);
        next.set('chapter', remaining[0].id);
        setSearch(next, { replace: false });
      }
    } catch {
      if (bookId) void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapters(bookId) });
    }
  }, [chapters, activeId, bookId, queryClient, search, setSearch]);

  if (!bookId) return <Navigate to="/books" replace />;

  if (error) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', padding: 32 }}>
        <div style={{ color: 'var(--danger)' }}>Ошибка: {error}</div>
      </div>
    );
  }

  if (!book || !chapters) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink-3)', padding: 32 }}>
        Загрузка…
      </div>
    );
  }

  return (
    <div style={{ height: '100vh' }}>
      <EditorHybrid
        defaultMode="studio"
        book={book}
        chapters={chapters}
        activeChapter={activeChapter}
        bookHref={`/books/${bookId}`}
        chapterActions={{ onSelectChapter: selectChapter, onCreateChapter, onStatusChange, onDeleteChapter }}
        onContentChange={onContentChange}
        onTitleChange={onTitleChange}
        onGoalChange={onGoalChange}
        saveState={saveState}
        savedAt={savedAt}
      />
    </div>
  );
}
