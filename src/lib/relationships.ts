import { supabase } from './supabase';

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

export async function listRelations(bookId: string): Promise<CharacterRelation[]> {
  const { data, error } = await supabase
    .from('character_relations')
    .select('*')
    .eq('book_id', bookId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CharacterRelation[];
}

export async function createRelation(
  bookId: string,
  userId: string,
  fromId: string,
  toId: string,
  label: string,
): Promise<CharacterRelation> {
  const { data, error } = await supabase
    .from('character_relations')
    .insert({ book_id: bookId, user_id: userId, from_character_id: fromId, to_character_id: toId, label })
    .select('*')
    .single();
  if (error) throw error;
  return data as CharacterRelation;
}

export async function updateRelationLabel(id: string, label: string): Promise<CharacterRelation> {
  const { data, error } = await supabase
    .from('character_relations')
    .update({ label })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as CharacterRelation;
}

export async function deleteRelation(id: string): Promise<void> {
  const { error } = await supabase.from('character_relations').delete().eq('id', id);
  if (error) throw error;
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

export async function listRelationships(bookId: string): Promise<CharacterRelationship[]> {
  const { data, error } = await supabase
    .from('character_relationships')
    .select('*')
    .eq('book_id', bookId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CharacterRelationship[];
}

export async function createRelationship(
  bookId: string,
  userId: string,
  charIdA: string,
  charIdB: string,
  labelMine: string,
  labelTheirs: string,
): Promise<CharacterRelationship> {
  // Каноническое хранение: char_a_id < char_b_id
  const canonical = charIdA < charIdB;
  const { data, error } = await supabase
    .from('character_relationships')
    .insert({
      book_id: bookId,
      user_id: userId,
      char_a_id: canonical ? charIdA : charIdB,
      char_b_id: canonical ? charIdB : charIdA,
      label_a: canonical ? labelMine : labelTheirs,
      label_b: canonical ? labelTheirs : labelMine,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as CharacterRelationship;
}

export async function updateRelationshipLabels(
  id: string,
  patch: { label_a?: string; label_b?: string },
): Promise<CharacterRelationship> {
  const { data, error } = await supabase
    .from('character_relationships')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as CharacterRelationship;
}

export async function deleteRelationship(id: string): Promise<void> {
  const { error } = await supabase.from('character_relationships').delete().eq('id', id);
  if (error) throw error;
}
