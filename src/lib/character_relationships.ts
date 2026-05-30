import { supabase } from './supabase';

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
