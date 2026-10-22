import type { QueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from './queries';
import type { Chapter, ChapterMeta } from './chapters';

// Только метаданные: текст главы в кэш из ответа сервера не пишется —
// источник правды для текста редактор (иначе запоздавший ответ откатывает ввод).
export function updateChapterWithCache(
  queryClient: QueryClient,
  bookId: string,
  updated: Chapter | ChapterMeta,
): void {
  const { content: _, ...updatedMeta } = updated as Chapter;
  queryClient.setQueryData<ChapterMeta[]>(QUERY_KEYS.chapters(bookId), (prev) =>
    prev ? prev.map((c) => (c.id === updated.id ? { ...c, ...updatedMeta } : c)) : prev,
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
