import { useState, useEffect, useRef } from 'react';
import { todayLocalISODate } from './dates';

interface Params {
  todayWords: number;
  dailyGoal: number;
  isLoading: boolean;
}

interface Result {
  toast: 'reached' | 'exceeded' | null;
}

export function useGoalToast({ todayWords, dailyGoal, isLoading }: Params): Result {
  const [toast, setToast] = useState<'reached' | 'exceeded' | null>(null);
  const prevTodayWords = useRef<number | null>(null);

  useEffect(() => {
    if (isLoading) return;
    // Первое реальное серверное значение — это baseline, а не "рост с нуля".
    // Иначе при перезагрузке/новом устройстве уже достигнутая цель триггерит тост повторно.
    if (prevTodayWords.current === null) {
      prevTodayWords.current = todayWords;
      return;
    }
    const prev = prevTodayWords.current;
    prevTodayWords.current = todayWords;
    if (!dailyGoal || todayWords === prev) return;
    const todayKey = `goal-toast-${todayLocalISODate()}`;
    if (localStorage.getItem(todayKey)) return;
    if (prev < dailyGoal && todayWords >= dailyGoal) {
      const kind = todayWords >= dailyGoal * 1.5 ? 'exceeded' : 'reached';
      setToast(kind);
      localStorage.setItem(todayKey, '1');
    }
  }, [todayWords, dailyGoal, isLoading]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => { setToast(null); }, 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return { toast };
}
