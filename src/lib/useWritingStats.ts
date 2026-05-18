import { useState, useEffect, useCallback } from 'react';
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

export function useWritingStats(bookId: string | undefined): WritingStats & { refetch: () => void } {
  const [stats, setStats] = useState<WritingStats>({ todayWords: 0, streak: 0 });

  const fetchStats = useCallback(() => {
    if (!bookId) return;

    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 31);

    supabase
      .from('writing_snapshots')
      .select('date, words')
      .eq('book_id', bookId)
      .gte('date', from.toISOString().slice(0, 10))
      .order('date', { ascending: false })
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) return;

        const snap: Record<string, number> = {};
        for (const row of data) snap[row.date as string] = row.words as number;

        const todayStr = today.toISOString().slice(0, 10);
        const yday = new Date(today);
        yday.setDate(yday.getDate() - 1);
        const ydayStr = yday.toISOString().slice(0, 10);

        const todayTotal = snap[todayStr] ?? 0;
        const ydayTotal = snap[ydayStr] ?? 0;
        const todayWords = Math.max(0, todayTotal - ydayTotal);

        // streak: считаем с сегодня назад, пока слова растут
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

        setStats({ todayWords, streak });
      });
  }, [bookId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { ...stats, refetch: fetchStats };
}
