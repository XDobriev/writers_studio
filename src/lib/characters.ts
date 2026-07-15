import { supabase, ensureAuthReady } from './supabase';
import { createRepository, DbError } from './repository';
import { optimizeImage, AVATAR_OPTS } from './imageOptimize';
import type { Tables } from './database.types';

export type CharacterRole = 'protagonist' | 'secondary' | 'minor';

// Выведено из БД (Tables<'characters'>); role сужен до union для ROLE_LABELS/exhaustive-проверок.
export type Character = Omit<Tables<'characters'>, 'role'> & { role: CharacterRole };

export type CharacterPatch = Partial<
  Pick<Character, 'name' | 'role' | 'age' | 'quote' | 'appearance' | 'personality' | 'interior_life' | 'exterior_life' | 'gap' | 'backstory' | 'notes' | 'position' | 'avatar_url' | 'aliases'>
>;

const repo = createRepository<Character>(
  'characters',
  { name: 'Без имени', role: 'protagonist', position: 0 },
  [{ column: 'position', ascending: true }, { column: 'created_at', ascending: true }],
);



export async function listCharactersPage(bookId: string, from: number, to: number): Promise<Character[]> {
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('book_id', bookId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
    .range(from, to);
  if (error) throw new DbError(error.message, error.code, 'characters');
  return (data ?? []) as Character[];
}

/** Шаг «добавить персонажа» в онбординге: важен факт, а не список — отсюда limit(1). */
export async function hasAnyCharacter(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('characters')
    .select('id')
    .eq('user_id', userId)
    .limit(1);
  if (error) throw new DbError(error.message, error.code, 'characters');
  return (data ?? []).length > 0;
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
  await ensureAuthReady();
  const optimized = await optimizeImage(file, AVATAR_OPTS);
  const ext = optimized.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}/${characterId}.${ext}`;
  const { error } = await supabase.storage
    .from('character-avatars')
    .upload(path, optimized, { upsert: true, contentType: optimized.type });
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

export async function searchCharactersServer(
  bookId: string,
  query: string,
  role: CharacterRole | 'all',
): Promise<Character[]> {
  let q = supabase
    .from('characters')
    .select('*')
    .eq('book_id', bookId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(200);
  if (role !== 'all') q = q.eq('role', role);
  if (query.trim()) q = q.ilike('name', `%${query.trim()}%`);
  const { data, error } = await q;
  if (error) throw new DbError(error.message, error.code, 'characters');
  return (data ?? []) as Character[];
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
