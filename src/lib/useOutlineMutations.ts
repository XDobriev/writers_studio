import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import type { NavigateFunction } from 'react-router-dom';
import { createChapter, deleteChapter, updateChapter, reorderChapters, renumberChapters, type ChapterMeta } from './chapters';
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

  const onRename = useCallback(async (id: string, title: string) => {
    if (!bookId) return;
    queryClient.setQueryData<ChapterMeta[]>(QUERY_KEYS.chapters(bookId), (prev) =>
      (prev ?? []).map((c) => (c.id === id ? { ...c, title } : c)),
    );
    try {
      await updateChapter(id, { title });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
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
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
      invalidateChaptersCache(queryClient, bookId);
    }
  }, [bookId, chapters, queryClient, setError]);

  const onPovChanged = useCallback(() => {
    if (bookId) void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapterPovMap(bookId) });
  }, [queryClient, bookId]);

  const onRenumber = useCallback(async () => {
    if (!bookId || !chapters) return;
    const toUpdate: Array<{ id: string; title: string }> = [];
    let rank = 0;
    chapters.forEach((c) => {
      if (/^Глава \d+$/.test(c.title)) {
        rank += 1;
        const next = `Глава ${rank}`;
        if (next !== c.title) toUpdate.push({ id: c.id, title: next });
      }
    });
    if (toUpdate.length === 0) return;
    const titleMap = new Map(toUpdate.map((u) => [u.id, u.title]));
    queryClient.setQueryData<ChapterMeta[]>(QUERY_KEYS.chapters(bookId), (prev) =>
      prev ? prev.map((c) => titleMap.has(c.id) ? { ...c, title: titleMap.get(c.id)! } : c) : prev,
    );
    try {
      await renumberChapters(toUpdate);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
      invalidateChaptersCache(queryClient, bookId);
    }
  }, [bookId, chapters, queryClient, setError]);

  return { onCreate, onDelete, onRename, onDragEnd, onPovChanged, onRenumber };
}
