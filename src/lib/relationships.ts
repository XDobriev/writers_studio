import { createRepository } from './repository';
import type { Tables } from './database.types';
import { supabase } from './supabase';
import type { ChapterMeta } from './chapters';

// --- Bilateral relationships (character_relationships: charIdA < charIdB canonical) ---

// Выведено из БД (Tables<'character_relationships'>) — сужений нет.
export type CharacterRelationship = Tables<'character_relationships'>;
export type RelationshipState = Pick<CharacterRelationship, 'label_a' | 'label_b' | 'is_secret'>;
export type RelationshipEvent = Tables<'character_relationship_events'>;
export type RelationshipEventInput = Pick<RelationshipEvent, 'chapter_id' | 'label_a' | 'label_b' | 'is_secret' | 'note'>;
export type RelationshipChapter = Pick<ChapterMeta, 'id' | 'title' | 'position' | 'created_at'>;

const relationshipsRepo = createRepository<CharacterRelationship>(
  'character_relationships',
  {},
  [{ column: 'created_at', ascending: true }],
);

async function listRows<T>(table: 'character_relationships' | 'character_relationship_events', bookId: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase.from(table).select('*').eq('book_id', bookId)
      .order('created_at').order('id').range(from, from + 499);
    if (error) throw error;
    rows.push(...(data ?? []) as T[]);
    if (!data || data.length < 500) return rows;
  }
}

export function listRelationships(bookId: string): Promise<CharacterRelationship[]> {
  return listRows('character_relationships', bookId);
}

export function createRelationship(
  bookId: string,
  userId: string,
  charIdA: string,
  charIdB: string,
  labelMine: string,
  labelTheirs: string,
  isSecret = false,
): Promise<CharacterRelationship> {
  const canonical = charIdA < charIdB;
  // Пустая подпись партнёра в форме означает «взаимная» — иначе у партнёра связь без подписи.
  const theirs = labelTheirs.trim() ? labelTheirs : labelMine;
  return relationshipsRepo.create(bookId, userId, {
    char_a_id: canonical ? charIdA : charIdB,
    char_b_id: canonical ? charIdB : charIdA,
    label_a: canonical ? labelMine : theirs,
    label_b: canonical ? theirs : labelMine,
    is_secret: isSecret,
  });
}

export function updateRelationshipLabels(
  id: string,
  patch: { label_a?: string; label_b?: string; is_secret?: boolean },
): Promise<CharacterRelationship> {
  return relationshipsRepo.update(id, patch);
}

const eventsRepo = createRepository<RelationshipEvent>('character_relationship_events');

export function listRelationshipEvents(bookId: string): Promise<RelationshipEvent[]> {
  return listRows('character_relationship_events', bookId);
}

export function createRelationshipEvent(bookId: string, userId: string, relationshipId: string, input: RelationshipEventInput): Promise<RelationshipEvent> {
  if (!input.chapter_id) throw new Error('Выберите главу изменения.');
  return eventsRepo.create(bookId, userId, { relationship_id: relationshipId, ...input });
}

export function updateRelationshipEvent(id: string, input: RelationshipEventInput): Promise<RelationshipEvent> {
  if (!input.chapter_id) throw new Error('Выберите главу изменения.');
  return eventsRepo.update(id, input);
}

export function deleteRelationshipEvent(id: string): Promise<void> {
  return eventsRepo.delete(id);
}

export function orderedRelationshipChapters(chapters: RelationshipChapter[]): RelationshipChapter[] {
  return [...chapters].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

/** Пустой chapterId — конец книги; baseline — исходное состояние. Осиротевшие записи остаются только в истории. */
export function resolveRelationship(rel: CharacterRelationship, events: RelationshipEvent[], chapters: RelationshipChapter[], chapterId = ''): CharacterRelationship {
  if (chapterId === 'baseline') return rel;
  const ranks = new Map(orderedRelationshipChapters(chapters).map((c, i) => [c.id, i]));
  const end = chapterId ? ranks.get(chapterId) : Infinity;
  if (end === undefined) return rel;
  let latest: RelationshipEvent | undefined;
  let latestRank = -1;
  for (const event of events) {
    if (event.relationship_id !== rel.id || !event.chapter_id) continue;
    const rank = ranks.get(event.chapter_id);
    if (rank !== undefined && rank <= end && rank > latestRank) {
      latest = event;
      latestRank = rank;
    }
  }
  return latest ? { ...rel, label_a: latest.label_a, label_b: latest.label_b, is_secret: latest.is_secret } : rel;
}

export function deleteRelationship(id: string): Promise<void> {
  return relationshipsRepo.delete(id);
}
