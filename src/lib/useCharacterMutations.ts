import { useCallback } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { NavigateOptions } from 'react-router-dom';
import {
  createCharacter,
  deleteCharacter,
  type Character,
} from './characters';
import {
  createRelation,
  deleteRelation,
  updateRelationLabel,
  type CharacterRelation,
} from './character_relations';
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
      queryClient.setQueryData<CharacterRelation[]>(QUERY_KEYS.relations(bookId), (prev) =>
        prev ? prev.filter((r) => r.from_character_id !== active.id && r.to_character_id !== active.id) : prev
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

  const onCreateRelation = useCallback(async (toId: string, label: string) => {
    if (!bookId || !userId || !active) return;
    try {
      const created = await createRelation(bookId, userId, active.id, toId, label);
      queryClient.setQueryData<CharacterRelation[]>(QUERY_KEYS.relations(bookId), (prev) => [...(prev ?? []), created]);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [bookId, userId, active, queryClient, setError]);

  const onDeleteRelation = useCallback(async (relationId: string) => {
    if (!bookId) return;
    try {
      await deleteRelation(relationId);
      queryClient.setQueryData<CharacterRelation[]>(QUERY_KEYS.relations(bookId), (prev) =>
        prev ? prev.filter((r) => r.id !== relationId) : prev
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }, [bookId, queryClient, setError]);

  const onRelationLabelChange = useCallback(async (relationId: string, label: string) => {
    if (!bookId) return;
    try {
      const updated = await updateRelationLabel(relationId, label);
      queryClient.setQueryData<CharacterRelation[]>(QUERY_KEYS.relations(bookId), (prev) =>
        prev ? prev.map((r) => (r.id === relationId ? updated : r)) : prev
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }, [bookId, queryClient, setError]);

  return { onCreate, onDelete, onDeleteConfirmed, onCreateRelation, onDeleteRelation, onRelationLabelChange };
}
