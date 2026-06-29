import { createRepository } from './repository';

// --- Bilateral relationships (character_relationships: charIdA < charIdB canonical) ---

export interface CharacterRelationship {
  id: string;
  book_id: string;
  user_id: string;
  char_a_id: string;
  char_b_id: string;
  label_a: string;
  label_b: string;
  created_at: string;
  updated_at: string;
}

const relationshipsRepo = createRepository<CharacterRelationship>(
  'character_relationships',
  {},
  [{ column: 'created_at', ascending: true }],
);

export function listRelationships(bookId: string): Promise<CharacterRelationship[]> {
  return relationshipsRepo.list(bookId);
}

export function createRelationship(
  bookId: string,
  userId: string,
  charIdA: string,
  charIdB: string,
  labelMine: string,
  labelTheirs: string,
): Promise<CharacterRelationship> {
  const canonical = charIdA < charIdB;
  return relationshipsRepo.create(bookId, userId, {
    char_a_id: canonical ? charIdA : charIdB,
    char_b_id: canonical ? charIdB : charIdA,
    label_a: canonical ? labelMine : labelTheirs,
    label_b: canonical ? labelTheirs : labelMine,
  });
}

export function updateRelationshipLabels(
  id: string,
  patch: { label_a?: string; label_b?: string },
): Promise<CharacterRelationship> {
  return relationshipsRepo.update(id, patch);
}

export function deleteRelationship(id: string): Promise<void> {
  return relationshipsRepo.delete(id);
}

/**
 * Собирает patch-объект для updateRelationshipLabels с точки зрения персонажа myId.
 * Скрывает инвариант canonical order char_a_id < char_b_id от вызывающего кода.
 */
export function makeLabelPatch(
  rel: CharacterRelationship,
  myId: string,
  labelMine: string,
  labelTheirs: string,
): { label_a?: string; label_b?: string } {
  const iAmA = rel.char_a_id === myId;
  return iAmA
    ? { label_a: labelMine, label_b: labelTheirs }
    : { label_b: labelMine, label_a: labelTheirs };
}
