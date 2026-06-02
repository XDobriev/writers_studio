import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams, Navigate } from 'react-router-dom';
import { useErrorState } from '../lib/useErrorState';
import { useDebouncedSave } from '../lib/useDebouncedSave';
import { useQueryClient } from '@tanstack/react-query';
import { EditorHybrid } from '../components/EditorHybrid';
import { useAuth } from '../lib/auth';
import { supabase, type Book } from '../lib/supabase';
import { updateBook } from '../lib/books';
import {
  countWords,
  createChapter,
  deleteChapter,
  updateChapter,
  type ChapterMeta,
  type ChapterPatch,
  type ChapterStatus,
  type SaveState,
} from '../lib/chapters';
import { QUERY_KEYS, useBook, useChapters, useChapterContent } from '../lib/queries';
import {
  updateChapterWithCache,
  createChapterWithCache,
  deleteChapterWithCache,
  invalidateChaptersCache,
} from '../lib/chapterMutations';
import { useUserDisplay } from '../lib/useUserDisplay';
import { useChapterVersioning } from '../lib/useChapterVersioning';
import { syncBacklinks } from '../lib/crossrefs';
import type { Character } from '../lib/characters';

export default function Editor() {
  const { id: bookId } = useParams<{ id: string }>();
  const [search, setSearch] = useSearchParams();
  const { user } = useAuth();

  const queryClient = useQueryClient();
  const { data: book, error: bookError } = useBook(bookId);
  const { data: chapters, error: chaptersError } = useChapters(bookId);
  const { error: mutationError, setError } = useErrorState();
  const error = (bookError ?? chaptersError)?.message ?? mutationError;
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const activeId = search.get('chapter');

  // Контент только активной главы — загружается отдельно, не вместе с метаданными
  const { data: chapterContentData } = useChapterContent(activeId ?? undefined);
  const activeContent = chapterContentData?.content ?? '';

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
    const nums = (chapters ?? []).map((c) => c.title.match(/^Глава (\d+)$/)).filter(Boolean).map((m) => parseInt(m![1]));
    const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    try {
      const created = await createChapter(bookId, user.id, {
        title: `Глава ${nextNum}`,
        position,
      });
      createChapterWithCache(queryClient, bookId!, created);
      const next = new URLSearchParams(search);
      next.set('chapter', created.id);
      setSearch(next, { replace: false });
    } catch (e) {
      setError((e as Error).message);
    }
  }, [bookId, user, chapters, queryClient, search, setSearch, setError]);

  const sessionTokenRef = useRef<string | null>(null);
  const { plan } = useUserDisplay();
  const isPro = plan === 'pro' || plan === 'lifetime';

  const { currentContentRef, onContentTracked, onChapterSwitch, onBeforeUnload } = useChapterVersioning({
    chapterId: activeId,
    userId: user?.id,
    isPro,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      sessionTokenRef.current = data.session?.access_token ?? null;
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      sessionTokenRef.current = session?.access_token ?? null;
    });
    return () => subscription.unsubscribe();
  }, []);

  const { scheduleSave: debouncedSave, flush, pendingPatchRef, targetIdRef } = useDebouncedSave<ChapterPatch>(
    async (id, patch) => {
      if (!bookId) return;
      setSaveState('saving');
      try {
        const updated = await updateChapter(id, patch);
        updateChapterWithCache(queryClient, bookId, updated);
        setSaveState('saved');
        setSavedAt(new Date());
        const characters = queryClient.getQueryData<Character[]>(QUERY_KEYS.characters(bookId)) ?? [];
        if (characters.length > 0) {
          void syncBacklinks(id, bookId, currentContentRef.current, characters)
            .then(() => { void queryClient.invalidateQueries({ queryKey: ['chapter-characters'] }); })
            .catch(() => { /* non-critical */ });
        }
      } catch (e) {
        setSaveState('error');
        throw e;
      }
    },
    700,
  );

  useEffect(() => {
    const handleBeforeUnload = () => {
      const patch = pendingPatchRef.current;
      const id = targetIdRef.current;
      const token = sessionTokenRef.current;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      if (patch && id && token) {
        void fetch(`${supabaseUrl}/rest/v1/chapters?id=eq.${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': anonKey,
            'Authorization': `Bearer ${token}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify(patch),
          keepalive: true,
        });
      }
      onBeforeUnload();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pendingPatchRef, targetIdRef, onBeforeUnload]);

  const scheduleSave = useCallback((id: string, patch: ChapterPatch) => {
    if (bookId) {
      // Оптимистично обновляем метаданные (title, words, status, position)
      const { content: _c, ...metaPatch } = patch;
      queryClient.setQueryData<ChapterMeta[]>(QUERY_KEYS.chapters(bookId), (prev) =>
        prev ? prev.map((c) => (c.id === id ? { ...c, ...metaPatch } : c)) : prev
      );
    }
    // Оптимистично обновляем контент-кеш (чтобы редактор видел актуальное значение)
    if (patch.content !== undefined) {
      queryClient.setQueryData<{ id: string; content: string }>(
        QUERY_KEYS.chapterContent(id),
        (prev) => prev ? { ...prev, content: patch.content! } : { id, content: patch.content! }
      );
    }
    setSaveState('saving');
    debouncedSave(id, patch);
  }, [debouncedSave, bookId, queryClient]);

  const lastActiveIdRef = useRef<string | null>(null);
  useEffect(() => {
    const newId = activeChapter?.id ?? null;
    if (lastActiveIdRef.current && lastActiveIdRef.current !== newId) {
      void flush();
      onChapterSwitch(lastActiveIdRef.current);
    }
    lastActiveIdRef.current = newId;
  }, [activeChapter, flush, onChapterSwitch]);

  // ВАЖНО: этот effect должен быть ПОСЛЕ chapter_switch effect выше.
  // Оба могут сработать в одном цикле рендера (когда activeChapter и activeContent
  // меняются одновременно при переходе на закэшированную главу).
  // Порядок объявления = порядок выполнения: chapter_switch читает currentContentRef
  // до того, как он будет перезаписан контентом новой главы.
  useEffect(() => { onContentTracked(activeContent); }, [activeContent, onContentTracked]);

  const onContentChange = useCallback((html: string) => {
    if (!activeChapter) return;
    onContentTracked(html);
    scheduleSave(activeChapter.id, { content: html, words: countWords(html) });
  }, [activeChapter, scheduleSave, onContentTracked]);

  const onTitleChange = useCallback((title: string) => {
    if (!activeChapter) return;
    scheduleSave(activeChapter.id, { title });
  }, [activeChapter, scheduleSave]);

  const onStatusChange = useCallback(async (id: string, status: ChapterStatus) => {
    if (bookId) {
      queryClient.setQueryData<ChapterMeta[]>(QUERY_KEYS.chapters(bookId), (prev) =>
        prev ? prev.map((c) => (c.id === id ? { ...c, status } : c)) : prev
      );
    }
    await updateChapter(id, { status }).catch(() => {
      if (bookId) invalidateChaptersCache(queryClient, bookId);
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
      if (bookId) deleteChapterWithCache(queryClient, bookId, id);
      const remaining = (chapters ?? []).filter((c) => c.id !== id);
      if (id === activeId && remaining.length > 0) {
        const next = new URLSearchParams(search);
        next.set('chapter', remaining[0].id);
        setSearch(next, { replace: false });
      }
    } catch {
      if (bookId) invalidateChaptersCache(queryClient, bookId);
    }
  }, [chapters, activeId, bookId, queryClient, search, setSearch]);

  if (!bookId) return <Navigate to="/books" replace />;

  if (bookError && (bookError as { code?: string }).code === 'NOT_FOUND') {
    return <Navigate to="/books" replace />;
  }

  if (error) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', padding: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ color: 'var(--danger)' }}>Ошибка: {error}</div>
        <a href="/books" style={{ color: 'var(--accent)', fontSize: 13 }}>← К книгам</a>
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
    <div style={{ height: '100dvh', overflow: 'hidden', position: 'relative' }}>
      {saveState === 'error' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
          background: 'var(--danger, #c0392b)', color: '#fff',
          padding: '8px 16px', fontSize: 13, display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <span>⚠ Последнее изменение не сохранено — нет соединения. Не закрывайте вкладку.</span>
          <button
            onClick={() => { void flush(); }}
            style={{ background: 'oklch(1 0 0 / 0.2)', border: 'none', color: 'oklch(0.98 0 0)',
              borderRadius: 4, padding: '2px 10px', cursor: 'pointer', fontSize: 12 }}
          >
            Повторить
          </button>
        </div>
      )}
      <EditorHybrid
        defaultMode="studio"
        book={book}
        chapters={chapters}
        activeChapter={activeChapter}
        activeContent={activeContent}
        chapterActions={{ onSelectChapter: selectChapter, onCreateChapter, onStatusChange, onDeleteChapter }}
        onContentChange={onContentChange}
        onTitleChange={onTitleChange}
        onGoalChange={onGoalChange}
        onSave={flush}
        saveState={saveState}
        savedAt={savedAt}
      />
    </div>
  );
}
