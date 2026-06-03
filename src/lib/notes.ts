import { supabase } from './supabase';
import { createRepository } from './repository';

export type NoteKind = 'idea' | 'question' | 'todo' | 'important' | 'custom';

export interface Note {
  id: string;
  user_id: string;
  book_id: string;
  chapter_id?: string | null;
  kind: NoteKind;
  text: string;
  custom_label?: string | null;
  custom_color?: string | null;
  position: number;
  created_at: string;
}

const repo = createRepository<Note>(
  'notes',
  {},
  [{ column: 'position', ascending: true }, { column: 'created_at', ascending: false }],
);

export function fetchNotes(bookId: string): Promise<Note[]> {
  return repo.list(bookId);
}

export async function createNote(
  bookId: string,
  kind: NoteKind,
  text: string,
  customLabel?: string,
  customColor?: string,
  chapterId?: string,
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
      position: 0,
      ...(kind === 'custom' && { custom_label: customLabel, custom_color: customColor }),
      ...(chapterId && { chapter_id: chapterId }),
    })
    .select()
    .single();
  if (error) throw error;
  return data as Note;
}

export function updateNote(
  id: string,
  kind: NoteKind,
  text: string,
  customLabel?: string,
  customColor?: string,
): Promise<Note> {
  return repo.update(id, {
    kind,
    text,
    custom_label: kind === 'custom' ? (customLabel ?? null) : null,
    custom_color: kind === 'custom' ? (customColor ?? null) : null,
  });
}

export function deleteNote(id: string): Promise<void> {
  return repo.delete(id);
}

export async function reorderNotes(updates: { id: string; position: number }[]): Promise<void> {
  if (updates.length === 0) return;
  const { error } = await supabase
    .from('notes')
    .upsert(updates, { onConflict: 'id' });
  if (error) throw error;
}
