import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import { createNote, updateNote, deleteNote, reorderNotes, type Note, type NoteKind } from './notes';
import { QUERY_KEYS } from './queries';

interface UseNoteMutationsOptions {
  bookId: string | undefined;
  setError: (msg: string) => void;
}

export function useNoteMutations({ bookId, setError }: UseNoteMutationsOptions) {
  const queryClient = useQueryClient();
  const addingRef = useRef(false);
  const updatingRef = useRef<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const onAdd = useCallback(async (
    kind: NoteKind,
    text: string,
    customLabel?: string,
    customColor?: string,
    chapterId?: string,
  ): Promise<Note | undefined> => {
    if (addingRef.current || !bookId || !text.trim()) return;
    addingRef.current = true;
    setIsSaving(true);
    try {
      const note = await createNote(bookId, kind, text.trim(), customLabel, customColor, chapterId);
      queryClient.setQueryData<Note[]>(QUERY_KEYS.notes(bookId), (prev) => [note, ...(prev ?? [])]);
      return note;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
    } finally {
      addingRef.current = false;
      setIsSaving(false);
    }
  }, [bookId, queryClient, setError]);

  const onUpdate = useCallback(async (
    id: string,
    kind: NoteKind,
    text: string,
    customLabel?: string,
    customColor?: string,
  ): Promise<Note | undefined> => {
    if (updatingRef.current.has(id) || !bookId || !text.trim()) return;
    updatingRef.current.add(id);
    setIsSaving(true);
    try {
      const updated = await updateNote(id, kind, text.trim(), customLabel, customColor);
      queryClient.setQueryData<Note[]>(QUERY_KEYS.notes(bookId), (prev) =>
        prev?.map((n) => (n.id === id ? updated : n)) ?? []
      );
      return updated;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
    } finally {
      updatingRef.current.delete(id);
      setIsSaving(false);
    }
  }, [bookId, queryClient, setError]);

  const onDelete = useCallback((id: string) => {
    if (!bookId) return;
    queryClient.setQueryData<Note[]>(QUERY_KEYS.notes(bookId), (prev) => prev?.filter((n) => n.id !== id) ?? []);
    deleteNote(id).catch((e: unknown) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notes(bookId) });
      setError(e instanceof Error ? e.message : 'Не удалось удалить заметку');
    });
  }, [bookId, queryClient, setError]);

  const onReorder = useCallback(async (notes: Note[], event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !bookId || active.id === over.id) return;

    const oldIndex = notes.findIndex((n) => n.id === active.id);
    const newIndex = notes.findIndex((n) => n.id === over.id);
    const reordered = arrayMove(notes, oldIndex, newIndex).map((n, i) => ({ ...n, position: i }));

    queryClient.setQueryData<Note[]>(QUERY_KEYS.notes(bookId), reordered);
    try {
      await reorderNotes(reordered.map((n) => ({ id: n.id, position: n.position })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notes(bookId) });
    }
  }, [bookId, queryClient, setError]);

  return { isSaving, onAdd, onUpdate, onDelete, onReorder };
}
