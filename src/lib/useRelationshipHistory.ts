import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listRelationshipEvents, createRelationshipEvent, updateRelationshipEvent, deleteRelationshipEvent,
  type RelationshipEvent, type RelationshipEventInput,
} from './relationships';

export const relationshipEventsKey = (bookId: string) => ['relationship-events', bookId] as const;

export function useRelationshipHistory(bookId: string | undefined, userId: string | undefined, enabled: boolean) {
  const client = useQueryClient();
  const key = relationshipEventsKey(bookId ?? '');
  // Быстрая перезагрузка может восстановить кэш до последней записи persister.
  const query = useQuery({ queryKey: key, queryFn: () => listRelationshipEvents(bookId!), enabled: !!bookId && enabled, staleTime: 60_000, refetchOnMount: 'always' });

  const save = async (relationshipId: string, input: RelationshipEventInput, id?: string) => {
    if (!bookId || !userId) throw new Error('Войдите в аккаунт, чтобы сохранить изменение.');
    const event = id
      ? await updateRelationshipEvent(id, input)
      : await createRelationshipEvent(bookId, userId, relationshipId, input);
    client.setQueryData<RelationshipEvent[]>(key, (prev) => [...(prev ?? []).filter((e) => e.id !== event.id), event]);
  };

  const remove = async (id: string) => {
    await deleteRelationshipEvent(id);
    client.setQueryData<RelationshipEvent[]>(key, (prev) => prev?.filter((e) => e.id !== id));
  };

  return { ...query, save, remove };
}
