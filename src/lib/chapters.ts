import { supabase } from './supabase';

export type ChapterStatus = 'draft' | 'progress' | 'done';
export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface Chapter {
  id: string;
  book_id: string;
  user_id: string;
  title: string;
  position: number;
  content: string;
  synopsis: string;
  words: number;
  status: ChapterStatus;
  created_at: string;
  updated_at: string;
}

export type ChapterMeta = Omit<Chapter, 'content'>;
export type ChapterPatch = Partial<Pick<Chapter, 'title' | 'content' | 'words' | 'status' | 'position' | 'synopsis'>>;

export interface ChapterActions {
  onSelectChapter?: (id: string) => void;
  onCreateChapter?: () => void;
  onStatusChange?: (id: string, status: ChapterStatus) => void;
  onDeleteChapter?: (id: string) => void;
  onChapterHover?: (id: string) => void;
}

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

// Полный список с контентом — только для экспорта/focus/split
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

// Только метаданные — для сайдбара, списков, дашборда (без контента)
export async function listChaptersMeta(bookId: string): Promise<ChapterMeta[]> {
  const { data, error } = await supabase
    .from('chapters')
    .select('id, book_id, user_id, title, position, synopsis, words, status, created_at, updated_at')
    .eq('book_id', bookId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChapterMeta[];
}

// Контент конкретной главы — загружать только при открытии
export async function getChapterContent(id: string): Promise<{ id: string; content: string }> {
  const { data, error } = await supabase
    .from('chapters')
    .select('id, content')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as { id: string; content: string };
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
  if (updates.length === 0) return;
  // upsert с частичными данными ломает RLS (INSERT-политика требует user_id).
  // Используем параллельные update() — они проверяют только UPDATE-политику.
  const results = await Promise.all(
    updates.map(({ id, position }) =>
      supabase.from('chapters').update({ position }).eq('id', id),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}
