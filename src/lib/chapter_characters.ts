import { supabase } from './supabase';

export interface ChapterCharacter {
  id: string;
  book_id: string;
  user_id: string;
  chapter_id: string;
  character_id: string;
  created_at: string;
}

export async function listChapterCharacters(bookId: string): Promise<ChapterCharacter[]> {
  const { data, error } = await supabase
    .from('chapter_characters')
    .select('*')
    .eq('book_id', bookId);
  if (error) throw error;
  return (data ?? []) as ChapterCharacter[];
}

export async function attachCharacterToChapter(
  bookId: string,
  userId: string,
  chapterId: string,
  characterId: string,
): Promise<ChapterCharacter> {
  const { data, error } = await supabase
    .from('chapter_characters')
    .insert({ book_id: bookId, user_id: userId, chapter_id: chapterId, character_id: characterId })
    .select('*')
    .single();
  if (error) throw error;
  return data as ChapterCharacter;
}

export async function detachCharacterFromChapter(
  chapterId: string,
  characterId: string,
): Promise<void> {
  const { error } = await supabase
    .from('chapter_characters')
    .delete()
    .eq('chapter_id', chapterId)
    .eq('character_id', characterId);
  if (error) throw error;
}
