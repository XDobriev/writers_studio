import type { QueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from './queries';
import type { Chapter, ChapterMeta } from './chapters';

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

// В БД удаление главы обнуляет chapter_id у событий и заметок, каскадом удаляет
// связи с персонажами и пересчитывает слова книги — освежаем всё это в кэше.
export function deleteChapterWithCache(
  queryClient: QueryClient,
  bookId: string,
  chapterId: string,
): void {
  queryClient.setQueryData<ChapterMeta[]>(QUERY_KEYS.chapters(bookId), (prev) =>
    prev ? prev.filter((c) => c.id !== chapterId) : prev,
  );
  queryClient.removeQueries({ queryKey: QUERY_KEYS.chapterContent(chapterId) });
  for (const key of [
    QUERY_KEYS.timelineEvents(bookId),
    QUERY_KEYS.notes(bookId),
    QUERY_KEYS.chapterPovMap(bookId),
    QUERY_KEYS.book(bookId),
    ['books'],
    QUERY_KEYS.chapterCharactersAll(),
  ]) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
}

export function invalidateChaptersCache(queryClient: QueryClient, bookId: string): void {
  void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapters(bookId) });
}
