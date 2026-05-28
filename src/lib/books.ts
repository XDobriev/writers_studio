import { supabase, type Book } from './supabase';

export type BookPatch = Partial<
  Pick<Book, 'title' | 'author' | 'genre' | 'words' | 'goal' | 'daily_goal' | 'cover' | 'share_token' | 'map_bg_url'>
>;

export interface BookCreateInput {
  user_id: string;
  title: string;
  genre: string | null;
  goal: number;
  words: number;
  cover: string;
}

export async function getBook(id: string): Promise<Book> {
  const { data, error } = await supabase.from('books').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) {
    const err = Object.assign(new Error('Книга не найдена'), { code: 'NOT_FOUND', status: 404 });
    throw err;
  }
  return data as Book;
}

export async function listBooks(): Promise<Book[]> {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Book[];
}

export async function createBook(input: BookCreateInput): Promise<Book> {
  const { data, error } = await supabase.from('books').insert(input).select().single();
  if (error) throw error;
  return data as Book;
}

export async function updateBook(id: string, patch: BookPatch): Promise<Book> {
  const { data, error } = await supabase
    .from('books')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Book;
}

export async function deleteBook(id: string): Promise<void> {
  const { error } = await supabase.from('books').delete().eq('id', id);
  if (error) throw error;
}

export interface WritingSnapshot {
  date: string;
  words: number;
}

export async function listWritingSnapshots(bookId: string, fromDate: string): Promise<WritingSnapshot[]> {
  const { data, error } = await supabase
    .from('writing_snapshots')
    .select('date, words')
    .eq('book_id', bookId)
    .gte('date', fromDate)
    .order('date', { ascending: true });
  if (error) throw error;
  return (data ?? []) as WritingSnapshot[];
}
