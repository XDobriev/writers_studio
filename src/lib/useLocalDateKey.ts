import { useEffect, useState } from 'react';
import { todayLocalISODate } from './dates';

/** Разбирает локальную ISO-дату YYYY-MM-DD в локальную полночь. */
export function parseLocalISODate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function msUntilNextLocalMidnight(): number {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0);
  return Math.max(1_000, next.getTime() - now.getTime());
}

/**
 * Реактивный ключ локальной даты (YYYY-MM-DD): обновляется ровно в локальную полночь,
 * а также при возврате фокуса/видимости вкладки (например, после сна ноутбука).
 */
export function useLocalDateKey(): string {
  const [dateKey, setDateKey] = useState(todayLocalISODate);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleMidnight = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const next = todayLocalISODate();
        setDateKey((prev) => (prev === next ? prev : next));
        scheduleMidnight();
      }, msUntilNextLocalMidnight());
    };

    const sync = () => {
      const next = todayLocalISODate();
      setDateKey((prev) => (prev === next ? prev : next));
      scheduleMidnight();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') sync();
    };

    scheduleMidnight();
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return dateKey;
}
