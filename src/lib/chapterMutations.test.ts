import { expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { deleteChapterWithCache } from './chapterMutations';
vi.mock('./queries', () => ({ QUERY_KEYS: {
  chapters: (id: string) => ['chapters', id], chapterContent: (id: string) => ['chapter-content', id],
  timelineEvents: (id: string) => ['timeline-events', id], notes: (id: string) => ['notes', id],
  chapterPovMap: (id: string) => ['chapter-pov-map', id], book: (id: string) => ['book', id], chapterCharactersAll: () => ['chapter-characters'],
} }));
vi.mock('./supabase', () => ({ supabase: {} }));
it('удаление главы инвалидирует сохранённую историю отношений', () => {
  const client = new QueryClient();
  client.setQueryData(['relationship-events', 'book'], [{ chapter_id: 'chapter' }]);
  deleteChapterWithCache(client, 'book', 'chapter');
  expect(client.getQueryState(['relationship-events', 'book'])?.isInvalidated).toBe(true);
  client.clear();
});
