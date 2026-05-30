import { supabase } from './supabase';

export const CHARACTER_COLORS = [
  'oklch(0.63 0.16 30)',
  'oklch(0.58 0.12 220)',
  'oklch(0.58 0.10 160)',
  'oklch(0.62 0.10 280)',
  'oklch(0.65 0.09 55)',
] as const;

export function getCharacterColor(index: number): string {
  return CHARACTER_COLORS[index % CHARACTER_COLORS.length];
}

export interface PovEntry {
  id: string;
  chapter_id: string;
  character_id: string;
  character_name: string;
  character_index: number;
}

export async function listBookPovEntries(bookId: string): Promise<PovEntry[]> {
  const { data, error } = await supabase
    .from('chapter_characters')
    .select('id, chapter_id, character_id, characters(name, position)')
    .eq('book_id', bookId)
    .eq('is_pov', true);
  if (error) throw error;
  return ((data ?? []) as unknown as Array<{
    id: string;
    chapter_id: string;
    character_id: string;
    characters: { name: string; position: number } | null;
  }>).map((row, i) => ({
    id: row.id,
    chapter_id: row.chapter_id,
    character_id: row.character_id,
    character_name: row.characters?.name ?? '',
    character_index: row.characters?.position ?? i,
  }));
}

export async function setPovCharacter(
  chapterId: string,
  characterId: string,
  bookId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('chapter_characters')
    .upsert(
      { chapter_id: chapterId, character_id: characterId, book_id: bookId, user_id: userId, is_pov: true, auto_detected: false },
      { onConflict: 'chapter_id,character_id' },
    );
  if (error) throw error;
}

export async function removePovCharacter(
  chapterId: string,
  characterId: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from('chapter_characters')
    .select('id, auto_detected')
    .eq('chapter_id', chapterId)
    .eq('character_id', characterId)
    .single();

  if (!existing) return;

  if (existing.auto_detected) {
    const { error: updateError } = await supabase
      .from('chapter_characters')
      .update({ is_pov: false })
      .eq('chapter_id', chapterId)
      .eq('character_id', characterId);
    if (updateError) throw updateError;
  } else {
    const { error: deleteError } = await supabase
      .from('chapter_characters')
      .delete()
      .eq('chapter_id', chapterId)
      .eq('character_id', characterId);
    if (deleteError) throw deleteError;
  }
}
