import { supabase } from './supabase';
import type { Tables } from './database.types';

// Замысел книги — один rich-text документ на книгу (R9).
// Полей нет: вся структура (принципы, акты, арки) живёт заголовками внутри HTML.
export type BookPlan = Tables<'book_plans'>;

/** Замысел книги или null, если автор его ещё не начинал (строки в БД нет). */
export async function getBookPlan(bookId: string): Promise<BookPlan | null> {
  const { data, error } = await supabase
    .from('book_plans')
    .select('*')
    .eq('book_id', bookId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Заводит строку замысла при первой правке. Пустой документ строки не создаёт —
 * плейсхолдер пустого состояния не является содержимым и в БД не попадает.
 * upsert по `book_id` (unique) переживает гонку двух вкладок: вторая не падает
 * на конфликте, а получает уже существующую строку.
 */
export async function ensureBookPlan(bookId: string, userId: string): Promise<BookPlan> {
  const { data, error } = await supabase
    .from('book_plans')
    .upsert({ book_id: bookId, user_id: userId }, { onConflict: 'book_id', ignoreDuplicates: false })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateBookPlan(id: string, content: string): Promise<BookPlan> {
  const { data, error } = await supabase
    .from('book_plans')
    .update({ content })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
