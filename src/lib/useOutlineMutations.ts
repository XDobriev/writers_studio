import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import type { NavigateFunction } from 'react-router-dom';
import { createChapter, deleteChapter, updateChapter, reorderChapters, type ChapterMeta } from './chapters';
import { QUERY_KEYS } from './queries';
import { createChapterWithCache, deleteChapterWithCache, invalidateChaptersCache } from './chapterMutations';

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
      const nums = (chapters ?? [])
        .map((c) => c.title.match(/^Глава (\d+)$/))
        .filter(Boolean)
        .map((m) => parseInt(m![1]));
      const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
      const created = await createChapter(bookId, userId, {
        title: `Глава ${nextNum}`,
        position: chapters?.length ?? 0,
      });
      createChapterWithCache(queryClient, bookId, created);
      navigate(`/books/${bookId}/editor?chapter=${created.id}`);
    } catch (e) {
      setError((e as Error).message);
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
      setError((e as Error).message);
      invalidateChaptersCache(queryClient, bookId);
    }
  }, [bookId, queryClient, setError]);

  const onRename = useCallback(async (id: string, title: string) => {
    if (!bookId) return;
    queryClient.setQueryData<ChapterMeta[]>(QUERY_KEYS.chapters(bookId), (prev) =>
      (prev ?? []).map((c) => (c.id === id ? { ...c, title } : c)),
    );
    try {
      await updateChapter(id, { title });
    } catch (e) {
      setError((e as Error).message);
      invalidateChaptersCache(queryClient, bookId);
    }
  }, [bookId, queryClient, setError]);

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
      setError((e as Error).message);
      invalidateChaptersCache(queryClient, bookId);
    }
  }, [bookId, chapters, queryClient, setError]);

  const onPovChanged = useCallback(() => {
    if (bookId) void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapterPovMap(bookId) });
  }, [queryClient, bookId]);

  return { onCreate, onDelete, onRename, onDragEnd, onPovChanged };
}
