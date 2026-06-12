import { vi, describe, it, expect } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

import { QUERY_KEYS } from './queries';

describe('QUERY_KEYS — структура', () => {
  it('books включает userId', () => {
    expect(QUERY_KEYS.books('u1')).toEqual(['books', 'u1']);
  });

  it('profile включает userId', () => {
    expect(QUERY_KEYS.profile('u1')).toEqual(['profile', 'u1']);
  });

  it('book включает bookId', () => {
    expect(QUERY_KEYS.book('b1')).toEqual(['book', 'b1']);
  });

  it('chapters включает bookId', () => {
    expect(QUERY_KEYS.chapters('b1')).toEqual(['chapters', 'b1']);
  });

  it('chapterContent включает chapterId', () => {
    expect(QUERY_KEYS.chapterContent('c1')).toEqual(['chapter-content', 'c1']);
  });

  it('characters включает bookId', () => {
    expect(QUERY_KEYS.characters('b1')).toEqual(['characters', 'b1']);
  });

  it('notes включает bookId', () => {
    expect(QUERY_KEYS.notes('b1')).toEqual(['notes', 'b1']);
  });

  it('relationships включает bookId', () => {
    expect(QUERY_KEYS.relationships('b1')).toEqual(['relationships', 'b1']);
  });

  it('writingSnapshots включает bookId', () => {
    expect(QUERY_KEYS.writingSnapshots('b1')).toEqual(['writing-snapshots', 'b1']);
  });

  it('locations включает bookId', () => {
    expect(QUERY_KEYS.locations('b1')).toEqual(['locations', 'b1']);
  });

  it('timelineEvents включает bookId', () => {
    expect(QUERY_KEYS.timelineEvents('b1')).toEqual(['timeline-events', 'b1']);
  });

  it('connections включает bookId', () => {
    expect(QUERY_KEYS.connections('b1')).toEqual(['connections', 'b1']);
  });

  it('chapterVersions включает chapterId', () => {
    expect(QUERY_KEYS.chapterVersions('c1')).toEqual(['chapter-versions', 'c1']);
  });

  it('chapterCharacters включает characterId', () => {
    expect(QUERY_KEYS.chapterCharacters('ch1')).toEqual(['chapter-characters', 'ch1']);
  });

  it('chapterCharactersAll — фиксированный ключ', () => {
    expect(QUERY_KEYS.chapterCharactersAll()).toEqual(['chapter-characters']);
  });

  it('chapterPovMap включает bookId', () => {
    expect(QUERY_KEYS.chapterPovMap('b1')).toEqual(['chapter-pov-map', 'b1']);
  });

  it('registrationOpen — фиксированный ключ', () => {
    expect(QUERY_KEYS.registrationOpen()).toEqual(['registration-open']);
  });
});

describe('QUERY_KEYS — детерминированность', () => {
  it('повторный вызов с теми же аргументами даёт равный массив', () => {
    expect(QUERY_KEYS.books('u1')).toEqual(QUERY_KEYS.books('u1'));
    expect(QUERY_KEYS.chapterVersions('c1')).toEqual(QUERY_KEYS.chapterVersions('c1'));
    expect(QUERY_KEYS.chapterPovMap('b1')).toEqual(QUERY_KEYS.chapterPovMap('b1'));
  });

  it('разные id дают разные ключи', () => {
    expect(QUERY_KEYS.book('b1')).not.toEqual(QUERY_KEYS.book('b2'));
    expect(QUERY_KEYS.chapters('b1')).not.toEqual(QUERY_KEYS.chapters('b2'));
  });
});

describe('QUERY_KEYS — отсутствие коллизий', () => {
  // Все book-level ключи с одинаковым id должны различаться первым элементом
  it('book-level ключи не пересекаются', () => {
    const id = 'same-id';
    const prefixes = [
      QUERY_KEYS.book(id),
      QUERY_KEYS.chapters(id),
      QUERY_KEYS.characters(id),
      QUERY_KEYS.notes(id),
      QUERY_KEYS.relationships(id),
      QUERY_KEYS.writingSnapshots(id),
      QUERY_KEYS.locations(id),
      QUERY_KEYS.timelineEvents(id),
      QUERY_KEYS.connections(id),
      QUERY_KEYS.chapterPovMap(id),
    ].map((k) => k[0]);

    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it('books и book имеют разный prefix', () => {
    expect(QUERY_KEYS.books('x')[0]).not.toBe(QUERY_KEYS.book('x')[0]);
  });

  it('chapterCharacters и chapterCharactersAll — разная длина ключа', () => {
    expect(QUERY_KEYS.chapterCharacters('x').length).toBeGreaterThan(
      QUERY_KEYS.chapterCharactersAll().length,
    );
  });
});
