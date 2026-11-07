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
  countWords,
  getChapterContent,
  type ChapterStatus,
} from '../lib/chapters';
import {
  type DraftConvertPlacement,
  type DraftInsertPosition,
} from '../lib/draftScenes';
import { type ChapterType } from '../lib/chapterNumbering';
import { QUERY_KEYS, useBook, useChapters, useChapterContent, useDraftScenes } from '../lib/queries';
import { useOutlineMutations } from '../lib/useOutlineMutations';
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
  const { data: draftScenes = [], isSuccess: draftsLoaded } = useDraftScenes(bookId);
  const { error: mutationError, setError, clearError } = useErrorState();
  // Только фатальные ошибки загрузки (книга/главы) заменяют экран целиком.
  // mutationError (статус главы, удаление и т.п.) — некритичен, показывается баннером поверх редактора.
  const error = (bookError ?? chaptersError)?.message;

  const activeDraftId = search.get('draft');
  const activeId = activeDraftId ? null : search.get('chapter');

  const { plan } = useUserDisplay();
  const isPro = plan === 'pro' || plan === 'lifetime';
  const autosave = useChapterAutosave({ bookId, userId: user?.id, isPro });
  const {
    flush,
    saveState,
    savedAt,
    scheduleDraft: scheduleDraftSave,
    flushDraft: flushDraftSave,
    cancelDraft: cancelDraftSave,
    draftSaveState,
    draftSavedAt,
  } = autosave;

  // Контент только активной главы — загружается отдельно, не вместе с метаданными.
  // До загрузки (ready) редактор не засеивается — защита от записи ввода в ещё
  // не загруженную главу. Локальный черновик, не дошедший до сервера, подмешивается здесь.
  const { data: chapterContentData } = useChapterContent(activeId ?? undefined);
  const activeMetaUpdatedAt = chapters?.find((c) => c.id === activeId)?.updated_at;
  const { content: activeContent, ready: activeContentReady } = useRecoveredChapterContent(
    activeId, chapterContentData, activeMetaUpdatedAt, autosave, { userId: user?.id, isPro },
  );

  useEffect(() => {
    if (activeDraftId) {
      if (draftsLoaded && !draftScenes.some((d) => d.id === activeDraftId)) {
        const next = new URLSearchParams(search);
        next.delete('draft');
        if (chapters && chapters.length > 0) next.set('chapter', chapters[0].id);
        setSearch(next, { replace: true });
      }
      return;
    }
    if (!chapters || chapters.length === 0) return;
    const exists = activeId && chapters.some((c) => c.id === activeId);
    if (!exists) {
      const firstId = chapters[0].id;
      if (bookId) localStorage.setItem(LAST_CHAPTER_KEY(bookId), firstId);
      const next = new URLSearchParams(search);
      next.set('chapter', firstId);
      setSearch(next, { replace: true });
    }
  }, [chapters, activeId, activeDraftId, draftScenes, draftsLoaded, search, setSearch, bookId]);

  const activeChapter = useMemo(
    () => (chapters && activeId ? chapters.find((c) => c.id === activeId) ?? null : null),
    [chapters, activeId],
  );

  const activeDraft = useMemo(
    () => (activeDraftId ? draftScenes.find((d) => d.id === activeDraftId) ?? null : null),
    [draftScenes, activeDraftId],
  );

  const selectChapter = useCallback((id: string) => {
    void flushDraftSave();
    if (bookId) localStorage.setItem(LAST_CHAPTER_KEY(bookId), id);
    const next = new URLSearchParams(search);
    next.delete('draft');
    next.set('chapter', id);
    setSearch(next, { replace: false });
  }, [search, setSearch, bookId, flushDraftSave]);

  const selectDraft = useCallback((id: string) => {
    void flush();
    void flushDraftSave();
    const next = new URLSearchParams(search);
    next.delete('chapter');
    next.set('draft', id);
    setSearch(next, { replace: false });
  }, [search, setSearch, flush, flushDraftSave]);

  const bookStructure = useOutlineMutations({
    bookId,
    userId: user?.id,
    chapters,
    draftScenes,
    setError,
    onCancelDraftSave: cancelDraftSave,
    onRebaseChapter: autosave.rebase,
  });

  const onCreateChapter = useCallback(async () => {
    if (!bookId || !user) return;
    await flushDraftSave();
    const created = await bookStructure.createChapter(false);
    if (created) {
      const next = new URLSearchParams(search);
      next.delete('draft');
      next.set('chapter', created.id);
      setSearch(next, { replace: false });
    }
  }, [bookId, user, flushDraftSave, bookStructure, search, setSearch]);

  const onCreateDraft = useCallback(async () => {
    if (!bookId || !user) return;
    await flush();
    await flushDraftSave();
    const created = await bookStructure.createDraft();
    if (created) {
      const next = new URLSearchParams(search);
      next.delete('chapter');
      next.set('draft', created.id);
      setSearch(next, { replace: false });
    }
  }, [bookId, user, flush, flushDraftSave, bookStructure, search, setSearch]);

  const onDeleteDraft = useCallback(async (id: string) => {
    if (!bookId) return;
    const remaining = draftScenes.filter((d) => d.id !== id);
    await bookStructure.deleteDraft(id);
    if (activeDraftId === id) {
      const next = new URLSearchParams(search);
      next.delete('draft');
      if (remaining.length > 0) {
        next.set('draft', remaining[0].id);
      } else if (chapters && chapters.length > 0) {
        next.set('chapter', chapters[0].id);
      }
      setSearch(next, { replace: false });
    }
  }, [bookId, draftScenes, bookStructure, activeDraftId, chapters, search, setSearch]);

  const onConvertDraftToChapter = useCallback(async (sceneId: string, placement: DraftConvertPlacement) => {
    await flushDraftSave();
    const res = await bookStructure.convertDraftToChapter(sceneId, placement);
    if (res) {
      const next = new URLSearchParams(search);
      next.delete('draft');
      next.set('chapter', res.chapter.id);
      setSearch(next, { replace: false });
    }
  }, [bookStructure, search, setSearch, flushDraftSave]);

  const onInsertDraftIntoChapter = useCallback(async (
    sceneId: string,
    targetChapterId: string,
    position: DraftInsertPosition,
  ) => {
    await flush();
    await flushDraftSave();
    const updated = await bookStructure.insertDraftToChapter(sceneId, targetChapterId, position);
    if (updated) {
      const next = new URLSearchParams(search);
      next.delete('draft');
      next.set('chapter', targetChapterId);
      setSearch(next, { replace: false });
    }
  }, [flush, flushDraftSave, bookStructure, search, setSearch]);

  const onDraftContentChange = useCallback((html: string) => {
    if (!activeDraft || !bookId) return;
    const words = countWords(html);
    scheduleDraftSave(activeDraft.id, { content: html, words });
  }, [activeDraft, bookId, scheduleDraftSave]);

  const onDraftTitleChange = useCallback((title: string) => {
    if (!activeDraft || !bookId) return;
    scheduleDraftSave(activeDraft.id, { title });
  }, [activeDraft, bookId, scheduleDraftSave]);

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
    await bookStructure.patchChapter(id, { status });
  }, [bookStructure]);

  const onTypeChange = useCallback(async (id: string, type: ChapterType) => {
    await bookStructure.changeChapterType(id, type);
  }, [bookStructure]);

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
    const remaining = (chapters ?? []).filter((c) => c.id !== id);
    const ok = await bookStructure.deleteChapter(id);
    if (ok && id === activeId && remaining.length > 0) {
      const next = new URLSearchParams(search);
      next.set('chapter', remaining[0].id);
      setSearch(next, { replace: false });
    }
  }, [chapters, bookStructure, activeId, search, setSearch]);

  const handleManualSave = useCallback(() => {
    if (activeDraft) void flushDraftSave();
    else void flush();
  }, [activeDraft, flushDraftSave, flush]);

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

  const effectiveSaveState = activeDraft ? draftSaveState : saveState;
  const effectiveSavedAt = activeDraft ? draftSavedAt : savedAt;

  return (
    <div style={{ height: '100dvh', overflow: 'hidden', position: 'relative' }}>
      {mutationError && (
        <ErrorBanner
          message={mutationError}
          onDismiss={clearError}
          style={{
            position: 'fixed', top: effectiveSaveState === 'error' ? 40 : 0, left: 0, right: 0, zIndex: 'var(--z-toast)',
            borderRadius: 0,
          }}
        />
      )}
      {effectiveSaveState === 'error' && <UnsavedBanner onRetry={handleManualSave} />}
      {autosave.notice && <SaveNotice message={autosave.notice} onDismiss={autosave.clearNotice} />}
      <EditorHybrid
        defaultMode="studio"
        book={book}
        chapters={chapters}
        activeChapter={activeChapter}
        activeContent={activeContent}
        activeContentReady={activeContentReady}
        chapterActions={{ onSelectChapter: selectChapter, onCreateChapter, onStatusChange, onTypeChange, onDeleteChapter, onChapterHover }}
        onContentChange={onContentChange}
        onTitleChange={onTitleChange}
        draftScenes={draftScenes}
        activeDraft={activeDraft}
        draftActions={{
          onSelectDraft: selectDraft,
          onCreateDraft,
          onDeleteDraft,
          onConvertDraftToChapter,
          onInsertDraftIntoChapter,
        }}
        onDraftContentChange={onDraftContentChange}
        onDraftTitleChange={onDraftTitleChange}
        onGoalChange={onGoalChange}
        onSave={handleManualSave}
        onBeforeRestore={onBeforeRestore}
        onRebase={autosave.rebase}
        saveState={effectiveSaveState}
        savedAt={effectiveSavedAt}
        versionToast={versionToast}
      />
    </div>
  );
}
