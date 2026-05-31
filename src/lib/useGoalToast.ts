import { useState, useEffect, useRef } from 'react';

interface Params {
  todayWords: number;
  dailyGoal: number;
}

interface Result {
  toast: 'reached' | 'exceeded' | null;
  toastLeaving: boolean;
}

export function useGoalToast({ todayWords, dailyGoal }: Params): Result {
  const [toast, setToast] = useState<'reached' | 'exceeded' | null>(null);
  const [toastLeaving, setToastLeaving] = useState(false);
  const prevTodayWords = useRef<number>(0);

  useEffect(() => {
    const prev = prevTodayWords.current;
    prevTodayWords.current = todayWords;
    if (!dailyGoal || todayWords === prev) return;
    const todayKey = `goal-toast-${new Date().toISOString().slice(0, 10)}`;
    if (localStorage.getItem(todayKey)) return;
    if (prev < dailyGoal && todayWords >= dailyGoal) {
      const kind = todayWords >= dailyGoal * 1.5 ? 'exceeded' : 'reached';
      setToast(kind);
      localStorage.setItem(todayKey, '1');
    }
  }, [todayWords, dailyGoal]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => {
      setToastLeaving(true);
    }, 3900);
    return () => clearTimeout(t);
  }, [toast]);

  return { toast, toastLeaving };
}
