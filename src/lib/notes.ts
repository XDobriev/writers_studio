import { supabase } from './supabase';

export type NoteKind = 'idea' | 'question' | 'todo' | 'important' | 'custom';

export interface Note {
  id: string;
  user_id: string;
  book_id: string;
  kind: NoteKind;
  text: string;
  custom_label?: string;
  custom_color?: string;
  created_at: string;
}

export async function fetchNotes(bookId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('book_id', bookId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Note[];
}

export async function createNote(
  bookId: string,
  kind: NoteKind,
  text: string,
  customLabel?: string,
  customColor?: string,
): Promise<Note> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not authenticated');
  const { data, error } = await supabase
    .from('notes')
    .insert({
      book_id: bookId,
      user_id: user.id,
      kind,
      text,
      ...(kind === 'custom' && { custom_label: customLabel, custom_color: customColor }),
    })
    .select()
    .single();
  if (error) throw error;
  return data as Note;
}

export async function updateNote(
  id: string,
  kind: NoteKind,
  text: string,
  customLabel?: string,
  customColor?: string,
): Promise<Note> {
  const { data, error } = await supabase
    .from('notes')
    .update({
      kind,
      text,
      custom_label: kind === 'custom' ? (customLabel ?? null) : null,
      custom_color: kind === 'custom' ? (customColor ?? null) : null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Note;
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase.from('notes').delete().eq('id', id);
  if (error) throw error;
}
