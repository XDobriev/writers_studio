import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import type { NavigateFunction } from 'react-router-dom';
import { createChapter, deleteChapter, updateChapter, reorderChapters, renumberChapters, type ChapterMeta, type ChapterPatch } from './chapters';
import { QUERY_KEYS } from './queries';
import { createChapterWithCache, deleteChapterWithCache, invalidateChaptersCache, updateChaptersTitlesWithCache } from './chapterMutations';
import { getNextChapterTitle, recalculateBookChapterTitles, getChaptersNeedingRenumber, type ChapterType } from './chapterNumbering';

interface UseOutlineMutationsOptions {
  bookId: string | undefined;
  userId: string | undefined;
  chapters: ChapterMeta[] | undefined;
  navigate: NavigateFunction;
  setError: (msg: string) => void;
}

export function useOutlineMutations({
  bookId, userId, chapters, navigate, setError,
}: UseOutlineMutationsOptions) {
  const queryClient = useQueryClient();
  const creatingRef = useRef(false);

  const onCreate = useCallback(async () => {
    if (!bookId || !userId || creatingRef.current) return;
    creatingRef.current = true;
    try {
      const title = getNextChapterTitle(chapters ?? []);
      const created = await createChapter(bookId, userId, {
        title,
        position: chapters?.length ?? 0,
      });
      createChapterWithCache(queryClient, bookId, created);
      navigate(`/books/${bookId}/editor?chapter=${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
    } finally {
      creatingRef.current = false;
    }
  }, [bookId, userId, chapters, queryClient, navigate, setError]);

  const onDelete = useCallback(async (id: string) => {
    if (!bookId) return;
    deleteChapterWithCache(queryClient, bookId, id);
    try {
      await deleteChapter(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
      invalidateChaptersCache(queryClient, bookId);
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

  return { onCreate, onDelete, onRename, onPatch, onDragEnd, onPovChanged, onRenumber, onTypeChange };
}
