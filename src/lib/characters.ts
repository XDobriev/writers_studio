import { supabase } from './supabase';
import { createRepository } from './repository';

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

const repo = createRepository<Character>(
  'characters',
  { name: 'Без имени', role: 'protagonist', position: 0 },
  [{ column: 'position', ascending: true }, { column: 'created_at', ascending: true }],
);

export function listCharacters(bookId: string, options?: { limit?: number }): Promise<Character[]> {
  return repo.list(bookId, options);
}

export function createCharacter(
  bookId: string,
  userId: string,
  patch: { name?: string; role?: CharacterRole; position?: number } = {},
): Promise<Character> {
  return repo.create(bookId, userId, patch);
}

export function updateCharacter(id: string, patch: CharacterPatch): Promise<Character> {
  return repo.update(id, patch);
}

export function deleteCharacter(id: string): Promise<void> {
  return repo.delete(id);
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

export async function deleteCharacterAvatar(characterId: string, avatarUrl: string): Promise<void> {
  const marker = '/character-avatars/';
  const idx = avatarUrl.indexOf(marker);
  if (idx !== -1) {
    void supabase.storage.from('character-avatars').remove([avatarUrl.slice(idx + marker.length)]);
  }
  await updateCharacter(characterId, { avatar_url: null });
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

export const ROLE_COLOR: Record<CharacterRole, string> = {
  protagonist: 'var(--accent)',
  secondary: 'var(--info)',
  minor: 'var(--ink-4)',
};

export const ROLE_PORTRAIT_BG: Record<CharacterRole, string> = {
  protagonist: 'linear-gradient(160deg, oklch(0.30 0.020 30), oklch(0.22 0.010 30))',
  secondary: 'linear-gradient(160deg, oklch(0.34 0.035 60), oklch(0.22 0.02 55))',
  minor: 'linear-gradient(160deg, oklch(0.30 0.03 80), oklch(0.20 0.02 80))',
};
