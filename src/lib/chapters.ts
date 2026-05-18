import { supabase } from './supabase';

export type ChapterStatus = 'draft' | 'progress' | 'done';

export interface Chapter {
  id: string;
  book_id: string;
  user_id: string;
  title: string;
  position: number;
  content: string;
  words: number;
  status: ChapterStatus;
  created_at: string;
  updated_at: string;
}

export type ChapterPatch = Partial<Pick<Chapter, 'title' | 'content' | 'words' | 'status' | 'position'>>;

export function countWords(html: string): number {
  if (!html) return 0;
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ');
  const matches = text.match(/[\p{L}\p{N}][\p{L}\p{N}'\-]*/gu);
  return matches ? matches.length : 0;
}

export async function listChapters(bookId: string): Promise<Chapter[]> {
  const { data, error } = await supabase
    .from('chapters')
    .select('*')
    .eq('book_id', bookId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Chapter[];
}

export async function getChapter(id: string): Promise<Chapter | null> {
  const { data, error } = await supabase.from('chapters').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Chapter | null) ?? null;
}

export async function createChapter(
  bookId: string,
  userId: string,
  patch: { title?: string; position?: number } = {},
): Promise<Chapter> {
  const { data, error } = await supabase
    .from('chapters')
    .insert({
      book_id: bookId,
      user_id: userId,
      title: patch.title ?? 'Без названия',
      position: patch.position ?? 0,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Chapter;
}

export async function updateChapter(id: string, patch: ChapterPatch): Promise<Chapter> {
  const { data, error } = await supabase
    .from('chapters')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Chapter;
}

export async function deleteChapter(id: string): Promise<void> {
  const { error } = await supabase.from('chapters').delete().eq('id', id);
  if (error) throw error;
}

export async function reorderChapters(updates: { id: string; position: number }[]): Promise<void> {
  await Promise.all(updates.map(({ id, position }) => updateChapter(id, { position })));
}
