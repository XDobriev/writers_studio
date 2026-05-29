import { supabase } from './supabase';

export type CharacterRole = 'protagonist' | 'secondary' | 'minor';

export interface Character {
  id: string;
  book_id: string;
  user_id: string;
  name: string;
  role: CharacterRole;
  age: number | null;
  quote: string;
  appearance: string;
  personality: string;
  interior_life: string;
  exterior_life: string;
  gap: string;
  backstory: string;
  notes: string;
  position: number;
  avatar_url: string | null;
  aliases: string[];
  created_at: string;
  updated_at: string;
}

export type CharacterPatch = Partial<
  Pick<Character, 'name' | 'role' | 'age' | 'quote' | 'appearance' | 'personality' | 'interior_life' | 'exterior_life' | 'gap' | 'backstory' | 'notes' | 'position' | 'avatar_url' | 'aliases'>
>;

export async function listCharacters(bookId: string): Promise<Character[]> {
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('book_id', bookId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Character[];
}

export async function createCharacter(
  bookId: string,
  userId: string,
  patch: { name?: string; role?: CharacterRole; position?: number } = {},
): Promise<Character> {
  const { data, error } = await supabase
    .from('characters')
    .insert({
      book_id: bookId,
      user_id: userId,
      name: patch.name ?? 'Без имени',
      role: patch.role ?? 'protagonist',
      position: patch.position ?? 0,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Character;
}

export async function updateCharacter(id: string, patch: CharacterPatch): Promise<Character> {
  const { data, error } = await supabase
    .from('characters')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Character;
}

export async function deleteCharacter(id: string): Promise<void> {
  const { error } = await supabase.from('characters').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadCharacterAvatar(characterId: string, userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${userId}/${characterId}.${ext}`;
  const { error } = await supabase.storage
    .from('character-avatars')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from('character-avatars').getPublicUrl(path);
  return data.publicUrl;
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '··';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export const ROLE_LABELS: Record<CharacterRole, string> = {
  protagonist: 'Главный герой',
  secondary: 'Второстепенный',
  minor: 'Эпизодический',
};
