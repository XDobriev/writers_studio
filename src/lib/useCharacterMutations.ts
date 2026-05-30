import { useCallback } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { NavigateOptions } from 'react-router-dom';
import {
  createCharacter,
  deleteCharacter,
  type Character,
} from './characters';
import {
  createRelationship,
  deleteRelationship,
  updateRelationshipLabels,
  type CharacterRelationship,
} from './character_relationships';
import { QUERY_KEYS } from './queries';
import type { CharacterViewMode } from './useCharacterNavigation';

interface UseCharacterMutationsOptions {
  bookId: string | undefined;
  userId: string | undefined;
  characters: Character[] | undefined;
  active: Character | null;
  queryClient: QueryClient;
  search: URLSearchParams;
  setSearch: (next: URLSearchParams, opts?: NavigateOptions) => void;
  setViewMode: (mode: CharacterViewMode) => void;
  setConfirmDelete: (v: boolean) => void;
  setError: (msg: string | null) => void;
  cancelSave: () => void;
}

export function useCharacterMutations({
  bookId,
  userId,
  characters,
  active,
  queryClient,
  search,
  setSearch,
  setViewMode,
  setConfirmDelete,
  setError,
  cancelSave,
}: UseCharacterMutationsOptions) {
  const onCreate = useCallback(async () => {
    if (!bookId || !userId) return;
    const position = characters?.length ?? 0;
    try {
      const created = await createCharacter(bookId, userId, {
        name: '',
        role: 'protagonist',
        position,
      });
      queryClient.setQueryData<Character[]>(QUERY_KEYS.characters(bookId), (prev) => [...(prev ?? []), created]);
      const next = new URLSearchParams(search);
      next.set('character', created.id);
      setSearch(next, { replace: false });
      setViewMode('detail');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [bookId, userId, characters, queryClient, search, setSearch, setViewMode, setError]);

  const onDelete = useCallback(() => {
    if (!active) return;
    setConfirmDelete(true);
  }, [active, setConfirmDelete]);

  const onDeleteConfirmed = useCallback(async () => {
    if (!active || !characters || !bookId) return;
    setConfirmDelete(false);
    cancelSave();
    try {
      await deleteCharacter(active.id);
      const remaining = characters.filter((c) => c.id !== active.id);
      queryClient.setQueryData<Character[]>(QUERY_KEYS.characters(bookId), remaining);
      queryClient.setQueryData<CharacterRelationship[]>(QUERY_KEYS.relationships(bookId), (prev) =>
        prev ? prev.filter((r) => r.char_a_id !== active.id && r.char_b_id !== active.id) : prev
      );
      const next = new URLSearchParams(search);
      if (remaining.length > 0) {
        next.set('character', remaining[0].id);
      } else {
        next.delete('character');
        setViewMode('grid');
      }
      setSearch(next, { replace: true });
    } catch (e) {
      setError((e as Error).message);
    }
  }, [active, characters, bookId, queryClient, search, setSearch, setViewMode, setConfirmDelete, cancelSave, setError]);

  const onCreateRelationship = useCallback(async (toId: string, labelMine: string, labelTheirs: string) => {
    if (!bookId || !userId || !active) return;
    try {
      const created = await createRelationship(bookId, userId, active.id, toId, labelMine, labelTheirs);
      queryClient.setQueryData<CharacterRelationship[]>(QUERY_KEYS.relationships(bookId), (prev) => [...(prev ?? []), created]);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [bookId, userId, active, queryClient, setError]);

  const onDeleteRelationship = useCallback(async (id: string) => {
    if (!bookId) return;
    try {
      await deleteRelationship(id);
      queryClient.setQueryData<CharacterRelationship[]>(QUERY_KEYS.relationships(bookId), (prev) =>
        prev ? prev.filter((r) => r.id !== id) : prev
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }, [bookId, queryClient, setError]);

  const onRelationshipLabelChange = useCallback(async (id: string, labelMine: string, labelTheirs: string) => {
    if (!bookId || !active) return;
    const rels = queryClient.getQueryData<CharacterRelationship[]>(QUERY_KEYS.relationships(bookId));
    const rel = rels?.find((r) => r.id === id);
    if (!rel) return;
    const iAmA = rel.char_a_id === active.id;
    const patch = iAmA
      ? { label_a: labelMine, label_b: labelTheirs }
      : { label_b: labelMine, label_a: labelTheirs };
    try {
      const updated = await updateRelationshipLabels(id, patch);
      queryClient.setQueryData<CharacterRelationship[]>(QUERY_KEYS.relationships(bookId), (prev) =>
        prev ? prev.map((r) => (r.id === id ? updated : r)) : prev
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }, [bookId, active, queryClient, setError]);

  return { onCreate, onDelete, onDeleteConfirmed, onCreateRelationship, onDeleteRelationship, onRelationshipLabelChange };
}
