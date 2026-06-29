import { toLocalISODate } from './dates';

export const HEATMAP_WEEKS = 52;

export interface ActivitySnapshot {
  date: string;
  words: number;
}

interface ActivityCell {
  date: string;
  delta: number;
  future: boolean;
  weekIdx: number;
}

export interface ActivityData {
  cells: ActivityCell[];
  weeks: number[];
  maxDelta: number;
  maxWeek: number;
  todayWords: number;
  streak: number;
  monthLabels: Array<{ col: number; label: string }>;
  cumulativeLine: Array<{ date: string; words: number }>;
  avg7: number;
  lastWeekWords: number;
}

// Превращает кумулятивные снапшоты слов в данные heatmap-активности за HEATMAP_WEEKS недель.
// `today` параметризован для тестируемости (по умолчанию — текущая дата).
// Даты — локальные (toLocalISODate), НЕ UTC: иначе граница суток смещается на часовой пояс.
export function computeActivityData(
  snapshots: ActivitySnapshot[],
  today: Date = new Date(),
): ActivityData {
  const snap: Record<string, number> = {};
  for (const row of snapshots) snap[row.date] = row.words;

  const todayStr = toLocalISODate(today);

  // Начало = понедельник недели за (HEATMAP_WEEKS - 1) недель до текущей
  const dow = today.getDay();
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - daysFromMon - (HEATMAP_WEEKS - 1) * 7);

  const cells: ActivityCell[] = [];
  for (let i = 0; i < HEATMAP_WEEKS * 7; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const ds = toLocalISODate(d);
    const future = ds > todayStr;
    const prev = new Date(d);
    prev.setDate(prev.getDate() - 1);
    const prevStr = toLocalISODate(prev);
    const delta = future ? 0 : Math.max(0, (snap[ds] ?? 0) - (snap[prevStr] ?? 0));
    cells.push({ date: ds, delta, future, weekIdx: Math.floor(i / 7) });
  }

  const weeks: number[] = Array.from({ length: HEATMAP_WEEKS }, (_, w) =>
    cells.slice(w * 7, w * 7 + 7).reduce((s, c) => s + c.delta, 0)
  );

  const maxDelta = Math.max(1, ...cells.map(c => c.delta));
  const maxWeek = Math.max(1, ...weeks);

  const cellByDate: Record<string, ActivityCell> = {};
  for (const c of cells) cellByDate[c.date] = c;

  let streak = 0;
  const streakStart = new Date(today);
  if ((cellByDate[todayStr]?.delta ?? 0) === 0) streakStart.setDate(streakStart.getDate() - 1);
  const cur = new Date(streakStart);
  for (let i = 0; i < 366; i++) {
    const ds = toLocalISODate(cur);
    if ((cellByDate[ds]?.delta ?? 0) > 0) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    } else {
      break;
    }
  }

  const todayWords = cellByDate[todayStr]?.delta ?? 0;

  const monthLabels: Array<{ col: number; label: string }> = [];
  let lastMonth = -1;
  for (let w = 0; w < HEATMAP_WEEKS; w++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + w * 7);
    const m = d.getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ col: w, label: d.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '') });
      lastMonth = m;
    }
  }

  const cumulativeLine: Array<{ date: string; words: number }> = [];
  let lastKnownWords = 0;
  let hasCumData = false;
  for (let w = 0; w < HEATMAP_WEEKS; w++) {
    const weekPastCells = cells.slice(w * 7, w * 7 + 7).filter(c => !c.future);
    if (weekPastCells.length === 0) continue;
    for (const c of weekPastCells) {
      if (snap[c.date] !== undefined) {
        lastKnownWords = snap[c.date];
        hasCumData = true;
      }
    }
    if (hasCumData) {
      cumulativeLine.push({ date: weekPastCells[weekPastCells.length - 1].date, words: lastKnownWords });
    }
  }

  const last7 = cells.filter(c => !c.future).slice(-7);
  const avg7 = last7.reduce((s, c) => s + c.delta, 0) / 7;
  const lastWeekWords = weeks[HEATMAP_WEEKS - 2] ?? 0;

  return { cells, weeks, maxDelta, maxWeek, todayWords, streak, monthLabels, cumulativeLine, avg7, lastWeekWords };
}
