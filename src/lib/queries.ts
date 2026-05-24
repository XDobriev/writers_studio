import { useQuery } from '@tanstack/react-query';
import { getBook, listBooks, listWritingSnapshots } from './books';
import { getProfile, type Profile } from './profiles';
import type { Book } from './supabase';
import { listChaptersMeta, getChapterContent, type ChapterMeta } from './chapters';
import { listCharacters, type Character } from './characters';
import { listRelations, type CharacterRelation } from './character_relations';
import { fetchNotes, type Note } from './notes';
import { listLocations, type Location } from './locations';
import { listTimelineEvents, type TimelineEvent } from './timeline';
import { listConnections, type LocationConnection } from './connections';
import { listVersions, type ChapterVersionMeta } from './versions';

export const QUERY_KEYS = {
  books: (userId: string) => ['books', userId] as const,
  profile: (userId: string) => ['profile', userId] as const,
  book: (id: string) => ['book', id] as const,
  chapters: (bookId: string) => ['chapters', bookId] as const,
  chapterContent: (id: string) => ['chapter-content', id] as const,
  characters: (bookId: string) => ['characters', bookId] as const,
  notes: (bookId: string) => ['notes', bookId] as const,
  relations: (bookId: string) => ['relations', bookId] as const,
  writingSnapshots: (bookId: string) => ['writing-snapshots', bookId] as const,
  locations: (bookId: string) => ['locations', bookId] as const,
  timelineEvents: (bookId: string) => ['timeline-events', bookId] as const,
  connections: (bookId: string) => ['connections', bookId] as const,
  chapterVersions: (chapterId: string) => ['chapter-versions', chapterId] as const,
};

export function useBook(id: string | undefined) {
  return useQuery({
    queryKey: id ? QUERY_KEYS.book(id) : ['book', null],
    queryFn: () => getBook(id!),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

export function useChapters(bookId: string | undefined) {
  return useQuery<ChapterMeta[]>({
    queryKey: bookId ? QUERY_KEYS.chapters(bookId) : ['chapters', null],
    queryFn: () => listChaptersMeta(bookId!),
    enabled: !!bookId,
    staleTime: 60_000,
  });
}

export function useChapterContent(chapterId: string | undefined) {
  return useQuery<{ id: string; content: string }>({
    queryKey: chapterId ? QUERY_KEYS.chapterContent(chapterId) : ['chapter-content', null],
    queryFn: () => getChapterContent(chapterId!),
    enabled: !!chapterId,
    staleTime: 30_000,
  });
}

export function useCharacters(bookId: string | undefined) {
  return useQuery<Character[]>({
    queryKey: bookId ? QUERY_KEYS.characters(bookId) : ['characters', null],
    queryFn: () => listCharacters(bookId!),
    enabled: !!bookId,
    staleTime: 2 * 60_000,
  });
}

export function useNotes(bookId: string | undefined) {
  return useQuery<Note[]>({
    queryKey: bookId ? QUERY_KEYS.notes(bookId) : ['notes', null],
    queryFn: () => fetchNotes(bookId!),
    enabled: !!bookId,
    staleTime: 2 * 60_000,
  });
}

export function useRelations(bookId: string | undefined) {
  return useQuery<CharacterRelation[]>({
    queryKey: bookId ? QUERY_KEYS.relations(bookId) : ['relations', null],
    queryFn: () => listRelations(bookId!),
    enabled: !!bookId,
    staleTime: 2 * 60_000,
  });
}

const SNAPSHOTS_FROM = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 366);
  return d.toISOString().slice(0, 10);
})();

export function useWritingSnapshots(bookId: string | undefined) {
  return useQuery({
    queryKey: bookId ? QUERY_KEYS.writingSnapshots(bookId) : ['writing-snapshots', null],
    queryFn: () => listWritingSnapshots(bookId!, SNAPSHOTS_FROM),
    enabled: !!bookId,
    staleTime: 5 * 60_000,
  });
}

export function useLocations(bookId: string | undefined) {
  return useQuery<Location[]>({
    queryKey: bookId ? QUERY_KEYS.locations(bookId) : ['locations', null],
    queryFn: () => listLocations(bookId!),
    enabled: !!bookId,
    staleTime: 2 * 60_000,
  });
}

export function useTimelineEvents(bookId: string | undefined) {
  return useQuery<TimelineEvent[]>({
    queryKey: bookId ? QUERY_KEYS.timelineEvents(bookId) : ['timeline-events', null],
    queryFn: () => listTimelineEvents(bookId!),
    enabled: !!bookId,
    staleTime: 2 * 60_000,
  });
}

export function useConnections(bookId: string | undefined) {
  return useQuery<LocationConnection[]>({
    queryKey: bookId ? QUERY_KEYS.connections(bookId) : ['connections', null],
    queryFn: () => listConnections(bookId!),
    enabled: !!bookId,
    staleTime: 2 * 60_000,
  });
}

export function useChapterVersions(chapterId: string | undefined) {
  return useQuery<ChapterVersionMeta[]>({
    queryKey: chapterId ? QUERY_KEYS.chapterVersions(chapterId) : ['chapter-versions', null],
    queryFn: () => listVersions(chapterId!),
    enabled: !!chapterId,
    staleTime: 30_000,
  });
}

export function useBooks(userId: string | undefined) {
  return useQuery<Book[]>({
    queryKey: userId ? QUERY_KEYS.books(userId) : ['books', null],
    queryFn: listBooks,
    enabled: !!userId,
    staleTime: 2 * 60_000,
  });
}

export function useProfile(userId: string | undefined) {
  return useQuery<Profile | null>({
    queryKey: userId ? QUERY_KEYS.profile(userId) : ['profile', null],
    queryFn: () => getProfile(userId!),
    enabled: !!userId,
    staleTime: 10 * 60_000,
  });
}
