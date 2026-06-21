import { useCallback, useRef } from 'react';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import {
  createCharacter,
  deleteCharacter,
  updateCharacter,
  type Character,
  type CharacterPatch,
} from './characters';
import { syncCharacterAcrossAllChapters } from './crossrefs';

// ─── InfiniteData helpers ────────────────────────────────────────────────────
// Чистые функции: единственное место, знающее о структуре InfiniteData<Character[]>.

export function charInfiniteUpdate(
  prev: InfiniteData<Character[]> | undefined,
  id: string,
  patch: Partial<Character>,
): InfiniteData<Character[]> | undefined {
  if (!prev) return prev;
  return { ...prev, pages: prev.pages.map((page) => page.map((c) => (c.id === id ? { ...c, ...patch } as Character : c))) };
}

export function charInfiniteConfirm(
  prev: InfiniteData<Character[]> | undefined,
  updated: Character,
): InfiniteData<Character[]> | undefined {
  if (!prev) return prev;
  return { ...prev, pages: prev.pages.map((page) => page.map((c) => (c.id === updated.id ? updated : c))) };
}

export function charInfiniteAppend(
  prev: InfiniteData<Character[]> | undefined,
  created: Character,
): InfiniteData<Character[]> {
  if (!prev) return { pages: [[created]], pageParams: [0] };
  const pages = [...prev.pages];
  pages[pages.length - 1] = [...pages[pages.length - 1], created];
  return { ...prev, pages };
}

export function charInfiniteRemove(
  prev: InfiniteData<Character[]> | undefined,
  id: string,
): InfiniteData<Character[]> | undefined {
  if (!prev) return prev;
  return { ...prev, pages: prev.pages.map((page) => page.filter((c) => c.id !== id)) };
}
import {
  createRelationship,
  deleteRelationship,
  updateRelationshipLabels,
  makeLabelPatch,
  type CharacterRelationship,
} from './relationships';
import { QUERY_KEYS } from './queries';

interface UseCharacterMutationsOptions {
  bookId: string | undefined;
  userId: string | undefined;
  characters: Character[] | undefined;
  active: Character | null;
  cancelSave: () => void;
  onError: (msg: string) => void;
  onCreated: (id: string) => void;
  onDeleted: (remaining: Character[], deletedId: string) => void;
}

export function useCharacterMutations({
  bookId,
  userId,
  characters,
  active,
  cancelSave,
  onError,
  onCreated,
  onDeleted,
}: UseCharacterMutationsOptions) {
  const queryClient = useQueryClient();
  const creatingRef = useRef(false);
  const onCreate = useCallback(async () => {
    if (!bookId || !userId || creatingRef.current) return;
    creatingRef.current = true;
    const position = characters?.length ?? 0;
    try {
      const created = await createCharacter(bookId, userId, {
        name: '',
        role: 'protagonist',
        position,
      });
      queryClient.setQueryData<InfiniteData<Character[]>>(QUERY_KEYS.characters(bookId), (prev) =>
        charInfiniteAppend(prev, created),
      );
      if (!localStorage.getItem('as_checklist_char')) {
        localStorage.setItem('as_checklist_char', '1');
      }
      onCreated(created.id);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      creatingRef.current = false;
    }
  }, [bookId, userId, characters, queryClient, onCreated, onError]);

  const onDeleteConfirmed = useCallback(async (characterId: string) => {
    if (!characters || !bookId) return;
    cancelSave();
    try {
      await deleteCharacter(characterId);
      const remaining = characters.filter((c) => c.id !== characterId);
      queryClient.setQueryData<InfiniteData<Character[]>>(QUERY_KEYS.characters(bookId), (prev) =>
        charInfiniteRemove(prev, characterId),
      );
      queryClient.setQueryData<CharacterRelationship[]>(QUERY_KEYS.relationships(bookId), (prev) =>
        prev ? prev.filter((r) => r.char_a_id !== characterId && r.char_b_id !== characterId) : prev
      );
      onDeleted(remaining, characterId);
    } catch (e) {
      onError((e as Error).message);
    }
  }, [characters, bookId, queryClient, cancelSave, onDeleted, onError]);

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
    const patch = makeLabelPatch(rel, active.id, labelMine, labelTheirs);
    try {
      const updated = await updateRelationshipLabels(id, patch);
      queryClient.setQueryData<CharacterRelationship[]>(QUERY_KEYS.relationships(bookId), (prev) =>
        prev ? prev.map((r) => (r.id === id ? updated : r)) : prev
      );
    } catch (e) {
      onError((e as Error).message);
    }
  }, [bookId, active, queryClient, onError]);

  const onUpdate = useCallback(async (id: string, patch: CharacterPatch): Promise<Character | undefined> => {
    if (!bookId) return;
    const snapshot = queryClient.getQueryData<InfiniteData<Character[]>>(QUERY_KEYS.characters(bookId));
    try {
      const updated = await updateCharacter(id, patch);
      queryClient.setQueryData<InfiniteData<Character[]>>(
        QUERY_KEYS.characters(bookId),
        (prev) => charInfiniteConfirm(prev, updated),
      );
      if (patch.name !== undefined || patch.aliases !== undefined) {
        void syncCharacterAcrossAllChapters(updated, bookId)
          .then(() => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapterCharactersAll() }))
          .catch(() => {});
      }
      return updated;
    } catch (e) {
      queryClient.setQueryData(QUERY_KEYS.characters(bookId), snapshot);
      throw e;
    }
  }, [bookId, queryClient]);

  return { onCreate, onUpdate, onDeleteConfirmed, onCreateRelationship, onDeleteRelationship, onRelationshipLabelChange };
}
