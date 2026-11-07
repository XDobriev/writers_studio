import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import type { NavigateFunction } from 'react-router-dom';
import {
  createChapter,
  deleteChapter,
  updateChapter,
  reorderChapters,
  renumberChapters,
  type Chapter,
  type ChapterMeta,
  type ChapterPatch,
} from './chapters';
import {
  createDraftScene,
  deleteDraftScene,
  convertDraftSceneToChapter,
  insertDraftSceneIntoChapter,
  type DraftScene,
  type DraftConvertPlacement,
  type DraftInsertPosition,
} from './draftScenes';
import { QUERY_KEYS } from './queries';
import {
  createChapterWithCache,
  deleteChapterWithCache,
  invalidateChaptersCache,
  updateChaptersTitlesWithCache,
} from './chapterMutations';
import {
  getNextChapterTitle,
  recalculateBookChapterTitles,
  getChaptersNeedingRenumber,
  type ChapterType,
} from './chapterNumbering';

export interface UseOutlineMutationsOptions {
  bookId: string | undefined;
  userId: string | undefined;
  chapters: ChapterMeta[] | undefined;
  draftScenes?: DraftScene[];
  navigate?: NavigateFunction;
  setError?: (msg: string) => void;
  onCancelDraftSave?: (id: string) => void;
  onRebaseChapter?: (chapterId: string, updatedAt: string) => void;
}

export function useOutlineMutations({
  bookId,
  userId,
  chapters,
  draftScenes,
  navigate,
  setError = () => {},
  onCancelDraftSave,
  onRebaseChapter,
}: UseOutlineMutationsOptions) {
  const queryClient = useQueryClient();
  const creatingRef = useRef(false);

  const createChapterAction = useCallback(async (navigateOnCreate = true): Promise<Chapter | null> => {
    if (!bookId || !userId || creatingRef.current) return null;
    creatingRef.current = true;
    try {
      const title = getNextChapterTitle(chapters ?? []);
      const created = await createChapter(bookId, userId, {
        title,
        position: chapters?.length ?? 0,
      });
      createChapterWithCache(queryClient, bookId, created);
      if (navigateOnCreate && navigate) {
        navigate(`/books/${bookId}/editor?chapter=${created.id}`);
      }
      return created;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
      return null;
    } finally {
      creatingRef.current = false;
    }
  }, [bookId, userId, chapters, queryClient, navigate, setError]);

  const deleteChapterAction = useCallback(async (id: string): Promise<boolean> => {
    if (!bookId) return false;
    deleteChapterWithCache(queryClient, bookId, id);
    try {
      await deleteChapter(id);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
      invalidateChaptersCache(queryClient, bookId);
      return false;
    }
  }, [bookId, queryClient, setError]);

  // Правка метаданных главы (название, статус, синопсис) с оптимистичным кэшем.
  const onPatch = useCallback(async (id: string, patch: Omit<ChapterPatch, 'content' | 'words'>) => {
    if (!bookId) return;
    queryClient.setQueryData<ChapterMeta[]>(QUERY_KEYS.chapters(bookId), (prev) =>
      (prev ?? []).map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
    try {
      await updateChapter(id, patch);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
      invalidateChaptersCache(queryClient, bookId);
    }
  }, [bookId, queryClient, setError]);

  const onRename = useCallback((id: string, title: string) => onPatch(id, { title }), [onPatch]);

  const onDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !bookId || !chapters || active.id === over.id) return;

    const oldIndex = chapters.findIndex((c) => c.id === active.id);
    const newIndex = chapters.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(chapters, oldIndex, newIndex).map((c, i) => ({ ...c, position: i }));

    queryClient.setQueryData<ChapterMeta[]>(QUERY_KEYS.chapters(bookId), reordered);
    try {
      await reorderChapters(reordered.map((c) => ({ id: c.id, position: c.position })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
      invalidateChaptersCache(queryClient, bookId);
    }
  }, [bookId, chapters, queryClient, setError]);

  const onPovChanged = useCallback(() => {
    if (bookId) void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapterPovMap(bookId) });
  }, [queryClient, bookId]);

  const onRenumber = useCallback(async () => {
    if (!bookId || !chapters) return;
    const toUpdate = getChaptersNeedingRenumber(chapters);
    if (toUpdate.length === 0) return;
    updateChaptersTitlesWithCache(queryClient, bookId, toUpdate);
    try {
      await renumberChapters(toUpdate);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
      invalidateChaptersCache(queryClient, bookId);
    }
  }, [bookId, chapters, queryClient, setError]);

  const onTypeChange = useCallback(async (chapterId: string, type: ChapterType) => {
    if (!bookId || !chapters) return;
    const { updates, nextChapters } = recalculateBookChapterTitles(chapters, chapterId, type);
    if (updates.length === 0) return;

    queryClient.setQueryData<ChapterMeta[]>(QUERY_KEYS.chapters(bookId), nextChapters);
    try {
      await renumberChapters(updates);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
      invalidateChaptersCache(queryClient, bookId);
    }
  }, [bookId, chapters, queryClient, setError]);

  const createDraft = useCallback(async (title?: string): Promise<DraftScene | null> => {
    if (!bookId || !userId) return null;
    try {
      const position = draftScenes?.length ?? 0;
      const defaultTitle = title || `Сцена ${position + 1}`;
      const created = await createDraftScene(bookId, userId, {
        title: defaultTitle,
        position,
      });
      queryClient.setQueryData<DraftScene[]>(QUERY_KEYS.draftScenes(bookId), (prev) => [
        ...(prev ?? []),
        created,
      ]);
      return created;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать черновик');
      return null;
    }
  }, [bookId, userId, draftScenes?.length, queryClient, setError]);

  const deleteDraft = useCallback(async (id: string): Promise<boolean> => {
    if (!bookId) return false;
    onCancelDraftSave?.(id);
    queryClient.setQueryData<DraftScene[]>(
      QUERY_KEYS.draftScenes(bookId),
      (prev) => (prev ? prev.filter((d) => d.id !== id) : prev),
    );
    try {
      await deleteDraftScene(id);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить черновик');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.draftScenes(bookId) });
      return false;
    }
  }, [bookId, onCancelDraftSave, queryClient, setError]);

  const convertDraftToChapter = useCallback(async (
    sceneId: string,
    placement: DraftConvertPlacement,
  ): Promise<{ chapter: Chapter; nextChapters: ChapterMeta[] } | null> => {
    if (!bookId || !chapters) return null;
    const scene = draftScenes?.find((d) => d.id === sceneId);
    if (!scene) return null;
    onCancelDraftSave?.(sceneId);
    try {
      const { chapter, nextChapters } = await convertDraftSceneToChapter(scene, chapters, placement);
      queryClient.setQueryData<ChapterMeta[]>(QUERY_KEYS.chapters(bookId), nextChapters);
      queryClient.setQueryData<{ id: string; content: string }>(
        QUERY_KEYS.chapterContent(chapter.id),
        { id: chapter.id, content: chapter.content },
      );
      queryClient.setQueryData<DraftScene[]>(
        QUERY_KEYS.draftScenes(bookId),
        (prev) => (prev ? prev.filter((d) => d.id !== sceneId) : prev),
      );
      return { chapter, nextChapters };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось преобразовать черновик');
      invalidateChaptersCache(queryClient, bookId);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.draftScenes(bookId) });
      return null;
    }
  }, [bookId, chapters, draftScenes, onCancelDraftSave, queryClient, setError]);

  const insertDraftToChapter = useCallback(async (
    sceneId: string,
    targetChapterId: string,
    position: DraftInsertPosition,
  ): Promise<Chapter | null> => {
    if (!bookId) return null;
    const scene = draftScenes?.find((d) => d.id === sceneId);
    if (!scene) return null;
    onCancelDraftSave?.(sceneId);
    try {
      const updated = await insertDraftSceneIntoChapter(scene, targetChapterId, position);
      queryClient.setQueryData<DraftScene[]>(
        QUERY_KEYS.draftScenes(bookId),
        (prev) => (prev ? prev.filter((d) => d.id !== sceneId) : prev),
      );
      queryClient.setQueryData<{ id: string; content: string }>(
        QUERY_KEYS.chapterContent(targetChapterId),
        { id: targetChapterId, content: updated.content },
      );
      queryClient.setQueryData<ChapterMeta[]>(QUERY_KEYS.chapters(bookId), (prev) =>
        prev
          ? prev.map((c) =>
              c.id === targetChapterId
                ? { ...c, words: updated.words, updated_at: updated.updated_at }
                : c,
            )
          : prev,
      );
      onRebaseChapter?.(targetChapterId, updated.updated_at);
      return updated;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось вставить черновик в главу');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapterContent(targetChapterId) });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.draftScenes(bookId) });
      return null;
    }
  }, [bookId, draftScenes, onCancelDraftSave, onRebaseChapter, queryClient, setError]);

  return {
    // Канонические методы структуры
    createChapter: createChapterAction,
    deleteChapter: deleteChapterAction,
    renameChapter: onRename,
    patchChapter: onPatch,
    changeChapterType: onTypeChange,
    reorderChaptersDrag: onDragEnd,
    renumberChaptersAuto: onRenumber,
    createDraft,
    deleteDraft,
    convertDraftToChapter,
    insertDraftToChapter,
    // Алиасы обратной совместимости для useOutlineMutations
    onCreate: createChapterAction,
    onDelete: deleteChapterAction,
    onRename,
    onPatch,
    onDragEnd,
    onPovChanged,
    onRenumber,
    onTypeChange,
  };
}

