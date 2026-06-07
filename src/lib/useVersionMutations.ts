import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createVersion, deleteVersion } from './versions';
import { countWords } from './chapters';
import { QUERY_KEYS } from './queries';

export function useVersionMutations(chapterId: string, userId: string, isPro: boolean) {
  const queryClient = useQueryClient();

  const createNamed = useCallback(async (content: string, label: string): Promise<void> => {
    await createVersion(chapterId, userId, content, countWords(content), 'manual', isPro, label);
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapterVersions(chapterId) });
  }, [chapterId, userId, isPro, queryClient]);

  const remove = useCallback(async (id: string): Promise<void> => {
    await deleteVersion(id);
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapterVersions(chapterId) });
  }, [chapterId, queryClient]);

  return { createNamed, remove };
}
