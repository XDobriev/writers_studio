import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

export interface WritingStats {
  todayWords: number;
  streak: number;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

function pluralDays(n: number): string {
  return plural(n, 'день', 'дня', 'дней');
}

export { pluralDays };

function computeStats(data: Array<{ date: string; words: number }>): WritingStats {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yday = new Date(today);
  yday.setDate(yday.getDate() - 1);
  const ydayStr = yday.toISOString().slice(0, 10);

  const snap: Record<string, number> = {};
  for (const row of data) snap[row.date] = row.words;

  const todayTotal = snap[todayStr] ?? 0;
  const ydayTotal = snap[ydayStr] ?? 0;
  const todayWords = Math.max(0, todayTotal - ydayTotal);

  let streak = 0;
  const cur = new Date(today);
  for (let i = 0; i < 31; i++) {
    const curStr = cur.toISOString().slice(0, 10);
    const prev = new Date(cur);
    prev.setDate(prev.getDate() - 1);
    const prevStr = prev.toISOString().slice(0, 10);
    if ((snap[curStr] ?? 0) > (snap[prevStr] ?? 0)) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    } else {
      break;
    }
  }

  return { todayWords, streak };
}

export function useWritingStats(bookId: string | undefined): WritingStats & { refetch: () => void } {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['writing-stats', bookId],
    queryFn: async () => {
      const today = new Date();
      const from = new Date(today);
      from.setDate(from.getDate() - 31);
      const fromStr = from.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from('writing_snapshots')
        .select('date, words')
        .eq('book_id', bookId!)
        .gte('date', fromStr)
        .order('date', { ascending: false });

      if (error || !data) return [];
      return data as Array<{ date: string; words: number }>;
    },
    enabled: !!bookId,
    staleTime: 60_000,
  });

  const refetch = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['writing-stats', bookId] });
  }, [queryClient, bookId]);

  const stats = data ? computeStats(data) : { todayWords: 0, streak: 0 };
  return { ...stats, refetch };
}
