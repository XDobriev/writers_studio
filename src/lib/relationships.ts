import { createRepository } from './repository';

// --- Directed relations (character_relations: from → to) ---

export interface CharacterRelation {
  id: string;
  book_id: string;
  user_id: string;
  from_character_id: string;
  to_character_id: string;
  label: string;
  created_at: string;
  updated_at: string;
}

const relationsRepo = createRepository<CharacterRelation>(
  'character_relations',
  {},
  [{ column: 'created_at', ascending: true }],
);

export function listRelations(bookId: string): Promise<CharacterRelation[]> {
  return relationsRepo.list(bookId);
}

export function createRelation(
  bookId: string,
  userId: string,
  fromId: string,
  toId: string,
  label: string,
): Promise<CharacterRelation> {
  return relationsRepo.create(bookId, userId, {
    from_character_id: fromId,
    to_character_id: toId,
    label,
  });
}

export function updateRelationLabel(id: string, label: string): Promise<CharacterRelation> {
  return relationsRepo.update(id, { label });
}

export function deleteRelation(id: string): Promise<void> {
  return relationsRepo.delete(id);
}

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
