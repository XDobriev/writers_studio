import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { computeActivityData } from './activity';
import { QUERY_KEYS, useWritingSnapshots } from './queries';
import { parseLocalISODate, useLocalDateKey } from './useLocalDateKey';

export interface WritingStats {
  todayWords: number;
  streak: number;
}

// Единый источник статистики для редактора и дашборда: общий кэш writingSnapshots
// (окно 366 дней) и единый расчёт todayWords/streak через computeActivityData.
export function useWritingStats(
  bookId: string | undefined,
  startWords = 0,
): WritingStats & { refetch: () => void; isLoading: boolean } {
  const queryClient = useQueryClient();
  const { data, isLoading } = useWritingSnapshots(bookId);
  const todayKey = useLocalDateKey();

  const refetch = useCallback(() => {
    if (!bookId) return;
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.writingSnapshots(bookId) });
  }, [queryClient, bookId]);

  const stats = useMemo<WritingStats>(() => {
    if (!data) return { todayWords: 0, streak: 0 };
    const { todayWords, streak } = computeActivityData(data, parseLocalISODate(todayKey), startWords);
    return { todayWords, streak };
  }, [data, startWords, todayKey]);

  return { ...stats, refetch, isLoading };
}
