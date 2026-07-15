import { supabase, type Book } from './supabase';
import type { Tables } from './database.types';

export type BookPatch = Partial<
  Pick<Book, 'title' | 'author' | 'genre' | 'genres' | 'words' | 'goal' | 'daily_goal' | 'cover' | 'share_token' | 'map_bg_url' | 'map_template'>
>;

export interface BookCreateInput {
  user_id: string;
  title: string;
  genre: string | null;
  genres: string[];
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

export type Series = Tables<'series'>;

/** Что переносить из книги-источника в книгу-продолжение. */
export interface SeriesTransferOptions {
  characters: boolean;
  locationsMap: boolean;
  notes: boolean;
  timeline: boolean;
}

export interface BookContentCounts {
  characters: number;
  locations: number;
  notes: number;
  timeline: number;
}

export async function listSeries(): Promise<Series[]> {
  const { data, error } = await supabase.from('series').select('*');
  if (error) throw error;
  return data ?? [];
}

/**
 * Серия создаётся в RPC с названием книги-источника — но название серии и название
 * первого романа совпадают редко. Без этого правка недоступна ниоткуда.
 */
export async function updateSeries(id: string, title: string): Promise<Series> {
  const { data, error } = await supabase
    .from('series')
    .update({ title })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

type CountableTable = 'characters' | 'locations' | 'notes' | 'timeline_events';

async function countRows(table: CountableTable, bookId: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('book_id', bookId);
  if (error) throw error;
  return count ?? 0;
}

/** Счётчики для чекбоксов переноса. Только чтение — Promise.all безопасен. */
export async function getBookContentCounts(bookId: string): Promise<BookContentCounts> {
  const [characters, locations, notes, timeline] = await Promise.all([
    countRows('characters', bookId),
    countRows('locations', bookId),
    countRows('notes', bookId),
    countRows('timeline_events', bookId),
  ]);
  return { characters, locations, notes, timeline };
}

/**
 * Копирует выбранное содержимое книги-источника в книгу-продолжение и связывает
 * обе книги в серию. Атомарно на стороне БД (RPC), с remap ID связей.
 * Книги остаются независимыми: правка/удаление в одной не влияет на другую.
 */
export async function duplicateBookContent(
  sourceBookId: string,
  targetBookId: string,
  opts: SeriesTransferOptions,
): Promise<void> {
  const { error } = await supabase.rpc('duplicate_book_content', {
    p_source: sourceBookId,
    p_target: targetBookId,
    p_characters: opts.characters,
    p_locations_map: opts.locationsMap,
    p_notes: opts.notes,
    p_timeline: opts.timeline,
  });
  if (error) throw error;
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

export type WritingSnapshot = Pick<Tables<'writing_snapshots'>, 'date' | 'words'>;

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
