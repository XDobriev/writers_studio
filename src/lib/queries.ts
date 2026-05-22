import { useQuery } from '@tanstack/react-query';
import { getBook, listWritingSnapshots } from './books';
import { listChapters, type Chapter } from './chapters';
import { listCharacters, type Character } from './characters';
import { listRelations, type CharacterRelation } from './character_relations';
import { fetchNotes, type Note } from './notes';
import { listLocations, type Location } from './locations';
import { listTimelineEvents, type TimelineEvent } from './timeline';

export const QUERY_KEYS = {
  book: (id: string) => ['book', id] as const,
  chapters: (bookId: string) => ['chapters', bookId] as const,
  characters: (bookId: string) => ['characters', bookId] as const,
  notes: (bookId: string) => ['notes', bookId] as const,
  relations: (bookId: string) => ['relations', bookId] as const,
  writingSnapshots: (bookId: string) => ['writing-snapshots', bookId] as const,
  locations: (bookId: string) => ['locations', bookId] as const,
  timelineEvents: (bookId: string) => ['timeline-events', bookId] as const,
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
  return useQuery<Chapter[]>({
    queryKey: bookId ? QUERY_KEYS.chapters(bookId) : ['chapters', null],
    queryFn: () => listChapters(bookId!),
    enabled: !!bookId,
    staleTime: 60_000,
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
