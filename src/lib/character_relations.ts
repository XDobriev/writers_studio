import { supabase } from './supabase';

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
