import type { QueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from './queries';
import type { Chapter, ChapterMeta } from './chapters';

export function updateChapterWithCache(
  queryClient: QueryClient,
  bookId: string,
  updated: Chapter,
): void {
  const { content: _, ...updatedMeta } = updated;
  queryClient.setQueryData<ChapterMeta[]>(QUERY_KEYS.chapters(bookId), (prev) =>
    prev ? prev.map((c) => (c.id === updated.id ? { ...c, ...updatedMeta } : c)) : prev,
  );
  queryClient.setQueryData<{ id: string; content: string }>(
    QUERY_KEYS.chapterContent(updated.id),
    { id: updated.id, content: updated.content },
  );
}

export function createChapterWithCache(
  queryClient: QueryClient,
  bookId: string,
  created: Chapter,
): void {
  const { content: _, ...createdMeta } = created;
  queryClient.setQueryData<ChapterMeta[]>(QUERY_KEYS.chapters(bookId), (prev) => [
    ...(prev ?? []),
    createdMeta,
  ]);
}

export function deleteChapterWithCache(
  queryClient: QueryClient,
  bookId: string,
  chapterId: string,
): void {
  queryClient.setQueryData<ChapterMeta[]>(QUERY_KEYS.chapters(bookId), (prev) =>
    prev ? prev.filter((c) => c.id !== chapterId) : prev,
  );
}

export function invalidateChaptersCache(queryClient: QueryClient, bookId: string): void {
  void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapters(bookId) });
}
