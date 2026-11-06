import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  createRelationship,
  deleteRelationship,
  updateRelationshipLabels,
  type CharacterRelationship,
  type RelationshipState,
} from './relationships';
import { QUERY_KEYS, useRelationships, useChapters } from './queries';
import { useRelationshipHistory, relationshipEventsKey } from './useRelationshipHistory';
import type { RelationshipWorkspaceDraft } from '../components/CharacterRelationsBlock';
import type { Character } from './characters';

export interface UseCharacterRelationshipsOptions {
  bookId: string | undefined;
  userId: string | undefined;
  activeId: string | undefined;
  characters: Character[] | undefined;
  enabled?: boolean;
}

export function useCharacterRelationships({
  bookId,
  userId,
  activeId,
  characters,
  enabled = true,
}: UseCharacterRelationshipsOptions) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useSearchParams();

  const relsQuery = useRelationships(bookId);
  const relationHistory = useRelationshipHistory(bookId, userId, enabled);
  const relationChapters = useChapters(enabled || relationHistory.data ? bookId : undefined);

  const [relationshipTrail, setRelationshipTrail] = useState<string[]>([]);
  const [draft, setDraft] = useState<RelationshipWorkspaceDraft>({ creation: null, history: null });
  const [error, setError] = useState<string | null>(null);

  // Предотвращение случайного ухода при открытом черновике связи
  const hasDraft = !!(draft.creation || draft.history);
  useEffect(() => {
    if (!hasDraft) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasDraft]);

  const requestedChapter = search.get('at') ?? search.get('chapter') ?? '';
  const chapterId = relationChapters.data && requestedChapter && requestedChapter !== 'baseline' && !relationChapters.data.some((c) => c.id === requestedChapter)
    ? 'baseline'
    : requestedChapter;

  const onChapterChange = useCallback((id: string) => {
    const next = new URLSearchParams(search);
    next.set('at', id);
    setSearch(next, { replace: true });
  }, [search, setSearch]);

  const onCreate = useCallback(async (
    toId: string,
    labelMine: string,
    labelTheirs: string,
    isSecret = false,
    sourceId = activeId,
  ) => {
    if (!bookId || !userId || !sourceId) return false;
    try {
      const created = await createRelationship(bookId, userId, sourceId, toId, labelMine, labelTheirs, isSecret);
      queryClient.setQueryData<CharacterRelationship[]>(QUERY_KEYS.relationships(bookId), (prev) => [...(prev ?? []), created]);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать связь');
      return false;
    }
  }, [bookId, userId, activeId, queryClient]);

  const onDelete = useCallback(async (id: string) => {
    if (!bookId) return false;
    try {
      await deleteRelationship(id);
      queryClient.setQueryData<CharacterRelationship[]>(QUERY_KEYS.relationships(bookId), (prev) =>
        prev ? prev.filter((r) => r.id !== id) : prev,
      );
      void queryClient.invalidateQueries({ queryKey: relationshipEventsKey(bookId) });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить связь');
      return false;
    }
  }, [bookId, queryClient]);

  const onLabelChange = useCallback(async (id: string, patch: RelationshipState) => {
    if (!bookId) return false;
    try {
      const updated = await updateRelationshipLabels(id, patch);
      queryClient.setQueryData<CharacterRelationship[]>(QUERY_KEYS.relationships(bookId), (prev) =>
        prev ? prev.map((r) => (r.id === id ? updated : r)) : prev,
      );
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось обновить связь');
      return false;
    }
  }, [bookId, queryClient]);

  const previousCharacter = characters?.find((c) => c.id === relationshipTrail[relationshipTrail.length - 1])?.name;

  const popTrail = useCallback(() => {
    if (relationshipTrail.length === 0) return null;
    const target = relationshipTrail[relationshipTrail.length - 1];
    setRelationshipTrail((prev) => prev.slice(0, -1));
    return target;
  }, [relationshipTrail]);

  const pushTrail = useCallback((currentId: string) => {
    setRelationshipTrail((prev) => [...prev, currentId]);
  }, []);

  return {
    relationships: relsQuery.data ?? [],
    events: relationHistory.data ?? [],
    chapters: relationChapters.data ?? [],
    chapterId,
    onChapterChange,
    draft,
    setDraft,
    hasDraft,
    onCreate,
    onDelete,
    onLabelChange,
    onSaveEvent: relationHistory.save,
    onDeleteEvent: relationHistory.remove,
    previousCharacter,
    popTrail,
    pushTrail,
    error: error || (relationHistory.error?.message ?? null) || (relationChapters.error?.message ?? null),
    isLoading: relsQuery.isLoading || relationHistory.isLoading || relationChapters.isLoading,
    refetchHistory: () => {
      void relationHistory.refetch();
      void relationChapters.refetch();
    },
  };
}
