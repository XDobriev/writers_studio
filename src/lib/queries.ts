import { useQuery } from '@tanstack/react-query';
import { getBook, listBooks, listWritingSnapshots } from './books';
import { getProfile, getRegistrationOpen, type Profile } from './profiles';
import type { Book } from './supabase';
import { listChaptersMeta, getChapterContent, type ChapterMeta } from './chapters';
import { listCharacters, type Character } from './characters';
import { listRelationships, type CharacterRelationship } from './relationships';
import { fetchNotes, type Note } from './notes';
import { listLocations, type Location } from './locations';
import { listTimelineEvents, type TimelineEvent } from './timeline';
import { listConnections, type LocationConnection } from './connections';
import { listVersions, type ChapterVersionMeta } from './versions';
import { listChapterCharacters, type ChapterCharacterRow } from './crossrefs';
import { listBookPovEntries, type PovEntry } from './pov';

export const QUERY_KEYS = {
  books: (userId: string) => ['books', userId] as const,
  profile: (userId: string) => ['profile', userId] as const,
  book: (id: string) => ['book', id] as const,
  chapters: (bookId: string) => ['chapters', bookId] as const,
  chapterContent: (id: string) => ['chapter-content', id] as const,
  characters: (bookId: string) => ['characters', bookId] as const,
  notes: (bookId: string) => ['notes', bookId] as const,
  relationships: (bookId: string) => ['relationships', bookId] as const,
  writingSnapshots: (bookId: string) => ['writing-snapshots', bookId] as const,
  locations: (bookId: string) => ['locations', bookId] as const,
  timelineEvents: (bookId: string) => ['timeline-events', bookId] as const,
  connections: (bookId: string) => ['connections', bookId] as const,
  chapterVersions: (chapterId: string) => ['chapter-versions', chapterId] as const,
  chapterCharacters: (characterId: string) => ['chapter-characters', characterId] as const,
  chapterCharactersAll: () => ['chapter-characters'] as const,
  chapterPovMap: (bookId: string) => ['chapter-pov-map', bookId] as const,
  registrationOpen: () => ['registration-open'] as const,
};

function makeQuery<T>(key: readonly unknown[], fn: () => Promise<T>, staleTime: number) {
  return {
    queryKey: key,
    queryFn: fn,
    enabled: key[key.length - 1] !== null,
    staleTime,
  };
}

export function useBook(id: string | undefined) {
  return useQuery(makeQuery(
    id ? QUERY_KEYS.book(id) : ['book', null],
    () => getBook(id!),
    5 * 60_000,
  ));
}

export function useChapters(bookId: string | undefined) {
  return useQuery<ChapterMeta[]>(makeQuery(
    bookId ? QUERY_KEYS.chapters(bookId) : ['chapters', null],
    () => listChaptersMeta(bookId!),
    60_000,
  ));
}

export function useChapterContent(chapterId: string | undefined) {
  return useQuery<{ id: string; content: string }>(makeQuery(
    chapterId ? QUERY_KEYS.chapterContent(chapterId) : ['chapter-content', null],
    () => getChapterContent(chapterId!),
    30_000,
  ));
}

export function useCharacters(bookId: string | undefined) {
  return useQuery<Character[]>(makeQuery(
    bookId ? QUERY_KEYS.characters(bookId) : ['characters', null],
    () => listCharacters(bookId!, { limit: 500 }),
    2 * 60_000,
  ));
}

export function useNotes(bookId: string | undefined) {
  return useQuery<Note[]>(makeQuery(
    bookId ? QUERY_KEYS.notes(bookId) : ['notes', null],
    () => fetchNotes(bookId!),
    2 * 60_000,
  ));
}

export function useRelationships(bookId: string | undefined) {
  return useQuery<CharacterRelationship[]>(makeQuery(
    bookId ? QUERY_KEYS.relationships(bookId) : ['relationships', null],
    () => listRelationships(bookId!),
    2 * 60_000,
  ));
}

const SNAPSHOTS_FROM = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 366);
  return d.toISOString().slice(0, 10);
})();

export function useWritingSnapshots(bookId: string | undefined) {
  return useQuery(makeQuery(
    bookId ? QUERY_KEYS.writingSnapshots(bookId) : ['writing-snapshots', null],
    () => listWritingSnapshots(bookId!, SNAPSHOTS_FROM),
    5 * 60_000,
  ));
}

export function useLocations(bookId: string | undefined) {
  return useQuery<Location[]>(makeQuery(
    bookId ? QUERY_KEYS.locations(bookId) : ['locations', null],
    () => listLocations(bookId!),
    2 * 60_000,
  ));
}

export function useTimelineEvents(bookId: string | undefined) {
  return useQuery<TimelineEvent[]>(makeQuery(
    bookId ? QUERY_KEYS.timelineEvents(bookId) : ['timeline-events', null],
    () => listTimelineEvents(bookId!),
    2 * 60_000,
  ));
}

export function useConnections(bookId: string | undefined) {
  return useQuery<LocationConnection[]>(makeQuery(
    bookId ? QUERY_KEYS.connections(bookId) : ['connections', null],
    () => listConnections(bookId!),
    2 * 60_000,
  ));
}

export function useChapterCharacters(characterId: string | undefined) {
  return useQuery<ChapterCharacterRow[]>(makeQuery(
    characterId ? QUERY_KEYS.chapterCharacters(characterId) : ['chapter-characters', null],
    () => listChapterCharacters(characterId!),
    30_000,
  ));
}

export function useChapterVersions(chapterId: string | undefined) {
  return useQuery<ChapterVersionMeta[]>(makeQuery(
    chapterId ? QUERY_KEYS.chapterVersions(chapterId) : ['chapter-versions', null],
    () => listVersions(chapterId!),
    30_000,
  ));
}

export function useBooks(userId: string | undefined) {
  return useQuery<Book[]>(makeQuery(
    userId ? QUERY_KEYS.books(userId) : ['books', null],
    listBooks,
    2 * 60_000,
  ));
}

export function useProfile(userId: string | undefined) {
  return useQuery<Profile | null>(makeQuery(
    userId ? QUERY_KEYS.profile(userId) : ['profile', null],
    () => getProfile(userId!),
    10 * 60_000,
  ));
}

export function useRegistrationOpen() {
  return useQuery({
    queryKey: QUERY_KEYS.registrationOpen(),
    queryFn: getRegistrationOpen,
    staleTime: 5 * 60_000,
  });
}

export function useChapterPovMap(bookId: string | undefined) {
  return useQuery<PovEntry[]>(makeQuery(
    bookId ? QUERY_KEYS.chapterPovMap(bookId) : ['chapter-pov-map', null],
    () => listBookPovEntries(bookId!),
    30_000,
  ));
}
