import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams, Navigate, Link } from 'react-router-dom';
import { useErrorState } from '../lib/useErrorState';
import { ErrorBanner } from '../components/ErrorBanner';
import { useQueryClient } from '@tanstack/react-query';
import { EditorHybrid } from '../components/EditorHybrid';
import { useAuth } from '../lib/auth';
import { type Book } from '../lib/supabase';
import { updateBook } from '../lib/books';
import {
  createChapter,
  deleteChapter,
  updateChapter,
  getChapterContent,
  type ChapterMeta,
  type ChapterStatus,
} from '../lib/chapters';
import { QUERY_KEYS, useBook, useChapters, useChapterContent } from '../lib/queries';
import {
  createChapterWithCache,
  deleteChapterWithCache,
  invalidateChaptersCache,
} from '../lib/chapterMutations';
import { useUserDisplay } from '../lib/useUserDisplay';
import { useChapterVersioning } from '../lib/useChapterVersioning';
import { useChapterAutosave, useRecoveredChapterContent } from '../lib/useChapterAutosave';
import { SaveNotice, UnsavedBanner } from '../components/SaveStatusBanners';

const LAST_CHAPTER_KEY = (bookId: string) => `lastChapter_${bookId}`;

export default function Editor() {
  const { id: bookId } = useParams<{ id: string }>();
  const [search, setSearch] = useSearchParams();
  const { user } = useAuth();

  const queryClient = useQueryClient();

  // Prefetch контента последней главы при холодном старте (нет chapter в URL).
  // Запускается один раз при монтировании, до того как chapters meta вернётся,
  // чтобы устранить waterfall: chapters → redirect → content.
  useEffect(() => {
    if (!bookId || search.get('chapter')) return;
    const storedId = localStorage.getItem(LAST_CHAPTER_KEY(bookId));
    if (!storedId) return;
    void queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.chapterContent(storedId),
      queryFn: () => getChapterContent(storedId),
      staleTime: 30_000,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: book, error: bookError } = useBook(bookId);
  const { data: chapters, error: chaptersError } = useChapters(bookId);
  const { error: mutationError, setError, clearError } = useErrorState();
  // Только фатальные ошибки загрузки (книга/главы) заменяют экран целиком.
  // mutationError (статус главы, удаление и т.п.) — некритичен, показывается баннером поверх редактора.
  const error = (bookError ?? chaptersError)?.message;

  const activeId = search.get('chapter');

  const { plan } = useUserDisplay();
  const isPro = plan === 'pro' || plan === 'lifetime';
  const autosave = useChapterAutosave({ bookId, userId: user?.id, isPro });
  const { flush, saveState, savedAt } = autosave;

  // Контент только активной главы — загружается отдельно, не вместе с метаданными.
  // До загрузки (ready) редактор не засеивается — защита от записи ввода в ещё
  // не загруженную главу. Локальный черновик, не дошедший до сервера, подмешивается здесь.
  const { data: chapterContentData } = useChapterContent(activeId ?? undefined);
  const activeMetaUpdatedAt = chapters?.find((c) => c.id === activeId)?.updated_at;
  const { content: activeContent, ready: activeContentReady } = useRecoveredChapterContent(
    activeId, chapterContentData, activeMetaUpdatedAt, autosave, { userId: user?.id, isPro },
  );

  useEffect(() => {
    if (!chapters || chapters.length === 0) return;
    const exists = activeId && chapters.some((c) => c.id === activeId);
    if (!exists) {
      const firstId = chapters[0].id;
      if (bookId) localStorage.setItem(LAST_CHAPTER_KEY(bookId), firstId);
      const next = new URLSearchParams(search);
      next.set('chapter', firstId);
      setSearch(next, { replace: true });
    }
  }, [chapters, activeId, search, setSearch, bookId]);

  const activeChapter = useMemo(
    () => (chapters && activeId ? chapters.find((c) => c.id === activeId) ?? null : null),
    [chapters, activeId],
  );

  const selectChapter = useCallback((id: string) => {
    if (bookId) localStorage.setItem(LAST_CHAPTER_KEY(bookId), id);
    const next = new URLSearchParams(search);
    next.set('chapter', id);
    setSearch(next, { replace: false });
  }, [search, setSearch, bookId]);

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
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
    }
  }, [bookId, user, chapters, queryClient, search, setSearch, setError]);

  const [versionToast, setVersionToast] = useState(false);
  const versionToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleVersionCreated = useCallback(() => {
    if (versionToastTimerRef.current) clearTimeout(versionToastTimerRef.current);
    setVersionToast(true);
    versionToastTimerRef.current = setTimeout(() => {
      setVersionToast(false);
    }, 2500);
  }, []);

  const { onContentTracked, onChapterSwitch } = useChapterVersioning({
    chapterId: activeId,
    userId: user?.id,
    isPro,
    onVersionCreated: handleVersionCreated,
  });

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
    autosave.scheduleContent(activeChapter.id, html);
  }, [activeChapter, autosave, onContentTracked]);

  const onTitleChange = useCallback((title: string) => {
    if (!activeChapter) return;
    autosave.schedule(activeChapter.id, { title });
  }, [activeChapter, autosave]);

  const onBeforeRestore = useCallback(async () => {
    if (activeId) await autosave.discard(activeId);
  }, [activeId, autosave]);

  const onStatusChange = useCallback(async (id: string, status: ChapterStatus) => {
    if (bookId) {
      queryClient.setQueryData<ChapterMeta[]>(QUERY_KEYS.chapters(bookId), (prev) =>
        prev ? prev.map((c) => (c.id === id ? { ...c, status } : c)) : prev
      );
    }
    await updateChapter(id, { status }).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
      if (bookId) invalidateChaptersCache(queryClient, bookId);
    });
  }, [bookId, queryClient, setError]);

  const onGoalChange = useCallback(async (goal: number) => {
    if (!bookId) return;
    const prevBook = queryClient.getQueryData<Book>(QUERY_KEYS.book(bookId));
    queryClient.setQueryData<Book>(QUERY_KEYS.book(bookId), (prev) =>
      prev ? { ...prev, daily_goal: goal } : prev
    );
    try {
      await updateBook(bookId, { daily_goal: goal });
    } catch (e) {
      queryClient.setQueryData<Book>(QUERY_KEYS.book(bookId), prevBook);
      setError(e instanceof Error ? e.message : 'Не удалось сохранить цель');
    }
  }, [bookId, queryClient, setError]);

  const onChapterHover = useCallback((id: string) => {
    void queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.chapterContent(id),
      queryFn: () => getChapterContent(id),
      staleTime: 30_000,
    });
  }, [queryClient]);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
      if (bookId) invalidateChaptersCache(queryClient, bookId);
    }
  }, [chapters, activeId, bookId, queryClient, search, setSearch, setError]);

  if (!bookId) return <Navigate to="/books" replace />;

  if (bookError && (bookError as { code?: string }).code === 'NOT_FOUND') {
    return <Navigate to="/books" replace />;
  }

  if (error) {
    return (
      <div className="as page-fill--error">
        <div style={{ color: 'var(--danger)' }}>Ошибка: {error}</div>
        <Link to="/books" style={{ color: 'var(--accent)', fontSize: 13 }}>← К книгам</Link>
      </div>
    );
  }

  if (!book || !chapters) {
    return (
      <div className="as page-fill--center">
        <div className="page-spinner" />
      </div>
    );
  }

  return (
    <div style={{ height: '100dvh', overflow: 'hidden', position: 'relative' }}>
      {mutationError && (
        <ErrorBanner
          message={mutationError}
          onDismiss={clearError}
          style={{
            position: 'fixed', top: saveState === 'error' ? 40 : 0, left: 0, right: 0, zIndex: 1000,
            borderRadius: 0,
          }}
        />
      )}
      {saveState === 'error' && <UnsavedBanner onRetry={() => { void flush(); }} />}
      {autosave.notice && <SaveNotice message={autosave.notice} onDismiss={autosave.clearNotice} />}
      <EditorHybrid
        defaultMode="studio"
        book={book}
        chapters={chapters}
        activeChapter={activeChapter}
        activeContent={activeContent}
        activeContentReady={activeContentReady}
        chapterActions={{ onSelectChapter: selectChapter, onCreateChapter, onStatusChange, onDeleteChapter, onChapterHover }}
        onContentChange={onContentChange}
        onTitleChange={onTitleChange}
        onGoalChange={onGoalChange}
        onSave={flush}
        onBeforeRestore={onBeforeRestore}
        onRebase={autosave.rebase}
        saveState={saveState}
        savedAt={savedAt}
        versionToast={versionToast}
      />
    </div>
  );
}
