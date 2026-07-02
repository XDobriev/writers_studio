import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { toLocalISODate } from './dates';

export interface WritingStats {
  todayWords: number;
  streak: number;
}

// Снапшоты разрежённые: строка пишется только когда words меняется (см. 0008_writing_snapshots.sql).
// День без строки — не обязательно день без прогресса, это может быть день ДО первого изменения в окне.
// Поэтому кумулятив на дату нужно переносить вперёд от ближайшей известной даты, а не подставлять 0.
function cumulativeAsOf(snap: Record<string, number>, dateStr: string): number {
  const known = Object.keys(snap).filter(d => d <= dateStr).sort();
  const last = known.at(-1);
  return last ? snap[last] : 0;
}

function computeStats(data: Array<{ date: string; words: number }>): WritingStats {
  const today = new Date();
  const todayStr = toLocalISODate(today);
  const snap: Record<string, number> = {};
  for (const row of data) snap[row.date] = row.words;

  const todayTotal = snap[todayStr] ?? 0;
  const prevDate = Object.keys(snap).filter(d => d < todayStr).sort().at(-1);
  const todayWords = Math.max(0, todayTotal - (prevDate ? snap[prevDate] : 0));

  let streak = 0;
  const cur = new Date(today);
  for (let i = 0; i < 31; i++) {
    const curStr = toLocalISODate(cur);
    const prev = new Date(cur);
    prev.setDate(prev.getDate() - 1);
    const prevStr = toLocalISODate(prev);
    if (cumulativeAsOf(snap, curStr) > cumulativeAsOf(snap, prevStr)) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    } else if (curStr === todayStr && !(curStr in snap)) {
      // сегодня ещё не писали ни строки — не обрываем серию, продолжаем со вчера
      cur.setDate(cur.getDate() - 1);
    } else {
      break;
    }
  }

  return { todayWords, streak };
}

export function useWritingStats(bookId: string | undefined): WritingStats & { refetch: () => void; isLoading: boolean } {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['writing-stats', bookId],
    queryFn: async () => {
      const today = new Date();
      const from = new Date(today);
      from.setDate(from.getDate() - 31);
      const fromStr = toLocalISODate(from);

      const { data, error } = await supabase
        .from('writing_snapshots')
        .select('date, words')
        .eq('book_id', bookId!)
        .gte('date', fromStr)
        .order('date', { ascending: false })
        .returns<Array<{ date: string; words: number }>>();

      if (error || !data) return [];
      return data;
    },
    enabled: !!bookId,
    staleTime: 60_000,
  });

  const refetch = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['writing-stats', bookId] });
  }, [queryClient, bookId]);

  const stats = data ? computeStats(data) : { todayWords: 0, streak: 0 };
  return { ...stats, refetch, isLoading };
}
