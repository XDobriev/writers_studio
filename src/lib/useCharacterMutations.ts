import { useCallback } from 'react';
import type { QueryClient } from '@tanstack/react-query';
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
} from './relationships';
import { QUERY_KEYS } from './queries';

interface UseCharacterMutationsOptions {
  bookId: string | undefined;
  userId: string | undefined;
  characters: Character[] | undefined;
  active: Character | null;
  queryClient: QueryClient;
  cancelSave: () => void;
  onError: (msg: string) => void;
  onCreated: (id: string) => void;
  onDeleted: (remaining: Character[]) => void;
}

export function useCharacterMutations({
  bookId,
  userId,
  characters,
  active,
  queryClient,
  cancelSave,
  onError,
  onCreated,
  onDeleted,
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
      onCreated(created.id);
    } catch (e) {
      onError((e as Error).message);
    }
  }, [bookId, userId, characters, queryClient, onCreated, onError]);

  const onDeleteConfirmed = useCallback(async () => {
    if (!active || !characters || !bookId) return;
    cancelSave();
    try {
      await deleteCharacter(active.id);
      const remaining = characters.filter((c) => c.id !== active.id);
      queryClient.setQueryData<Character[]>(QUERY_KEYS.characters(bookId), remaining);
      queryClient.setQueryData<CharacterRelationship[]>(QUERY_KEYS.relationships(bookId), (prev) =>
        prev ? prev.filter((r) => r.char_a_id !== active.id && r.char_b_id !== active.id) : prev
      );
      onDeleted(remaining);
    } catch (e) {
      onError((e as Error).message);
    }
  }, [active, characters, bookId, queryClient, cancelSave, onDeleted, onError]);

  const onCreateRelationship = useCallback(async (toId: string, labelMine: string, labelTheirs: string) => {
    if (!bookId || !userId || !active) return;
    try {
      const created = await createRelationship(bookId, userId, active.id, toId, labelMine, labelTheirs);
      queryClient.setQueryData<CharacterRelationship[]>(QUERY_KEYS.relationships(bookId), (prev) => [...(prev ?? []), created]);
    } catch (e) {
      onError((e as Error).message);
    }
  }, [bookId, userId, active, queryClient, onError]);

  const onDeleteRelationship = useCallback(async (id: string) => {
    if (!bookId) return;
    try {
      await deleteRelationship(id);
      queryClient.setQueryData<CharacterRelationship[]>(QUERY_KEYS.relationships(bookId), (prev) =>
        prev ? prev.filter((r) => r.id !== id) : prev
      );
    } catch (e) {
      onError((e as Error).message);
    }
  }, [bookId, queryClient, onError]);

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
      onError((e as Error).message);
    }
  }, [bookId, active, queryClient, onError]);

  return { onCreate, onDeleteConfirmed, onCreateRelationship, onDeleteRelationship, onRelationshipLabelChange };
}
