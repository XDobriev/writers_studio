import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createVersion, deleteVersion, type ChapterVersionMeta } from './versions';
import { countWords } from './chapters';
import { QUERY_KEYS } from './queries';

export function useVersionMutations(chapterId: string, userId: string) {
  const queryClient = useQueryClient();

  const createNamed = useCallback(async (content: string, label: string): Promise<void> => {
    await createVersion(chapterId, userId, content, countWords(content), 'manual', label);
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapterVersions(chapterId) });
  }, [chapterId, userId, queryClient]);

  const remove = useCallback(async (id: string): Promise<void> => {
    await deleteVersion(id);
    queryClient.setQueryData<ChapterVersionMeta[]>(
      QUERY_KEYS.chapterVersions(chapterId),
      (prev) => prev?.filter((v) => v.id !== id) ?? []
    );
  }, [chapterId, queryClient]);

  return { createNamed, remove };
}
