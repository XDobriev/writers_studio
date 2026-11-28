import { describe, it, expect } from 'vitest';
import { computeActivityData, HEATMAP_WEEKS } from './activity';
import { toLocalISODate } from './dates';

describe('computeActivityData', () => {
  // Локальная полночь — toLocalISODate даёт одну и ту же дату в любой таймзоне.
  const today = new Date(2026, 5, 15);
  const todayStr = toLocalISODate(today);
  const yesterdayStr = toLocalISODate(new Date(2026, 5, 14));

  it('пустые снапшоты → нулевая активность и корректная размерность сетки', () => {
    const d = computeActivityData([], today);
    expect(d.cells).toHaveLength(HEATMAP_WEEKS * 7);
    expect(d.weeks).toHaveLength(HEATMAP_WEEKS);
    expect(d.todayWords).toBe(0);
    expect(d.streak).toBe(0);
    expect(d.maxDelta).toBe(1); // clamp до 1, чтобы не делить на ноль
    expect(d.monthLabels.length).toBeGreaterThan(0);
  });

  it('дельта дня = разница кумулятивных снапшотов, streak считает подряд активные дни', () => {
    const d = computeActivityData(
      [{ date: yesterdayStr, words: 100 }, { date: todayStr, words: 250 }],
      today,
    );
    expect(d.todayWords).toBe(150);
    expect(d.streak).toBe(2);
  });

  it('импортированная рукопись — точка отсчёта, а не «написано сегодня»', () => {
    // Импорт 50 000 слов сегодня, потом дописано 300.
    const d = computeActivityData([{ date: todayStr, words: 50_300 }], today, 50_000);
    expect(d.todayWords).toBe(300);
    expect(d.maxDelta).toBe(300);
  });

  it('будущие дни не учитываются (delta = 0)', () => {
    const d = computeActivityData([{ date: todayStr, words: 500 }], today);
    expect(d.cells.filter(c => c.future).every(c => c.delta === 0)).toBe(true);
  });

  it('разрыв между снапшотами не приписывает весь накопленный объём одному дню', () => {
    // Реальный кейс: снапшот 6 апреля (1312 слов), следующий — только 15 июня
    // (1323 слова, "today"). Дельта дня должна быть 11, а не 1323 (весь объём книги).
    const oldSnapshotStr = toLocalISODate(new Date(2026, 3, 6));
    const d = computeActivityData(
      [{ date: oldSnapshotStr, words: 1312 }, { date: todayStr, words: 1323 }],
      today,
    );
    expect(d.todayWords).toBe(11);
    const todayCell = d.cells.find(c => c.date === todayStr);
    expect(todayCell?.delta).toBe(11);
  });

  it('при наличии written_words использует его вместо legacy-разницы words (структурные операции дают 0)', () => {
    const d = computeActivityData(
      [
        { date: yesterdayStr, words: 1000, written_words: null },
        // Например, восстановили длинную версию или сконвертировали вчерашний черновик:
        // books.words вырос на 500, но written_words = 0 (триггер не засчитал как написанное сегодня).
        { date: todayStr, words: 1500, written_words: 0 },
      ],
      today,
    );
    expect(d.todayWords).toBe(0);
    // Серия со вчера (1000 > 0) не ломается, даже если сегодня есть строка с written_words = 0.
    expect(d.streak).toBe(1);
  });

  it('слова, написанные в свободной сцене (written_words > 0 при неизменном books.words), засчитываются в сегодня и серию', () => {
    const d = computeActivityData(
      [
        { date: yesterdayStr, words: 1000, written_words: 200 },
        { date: todayStr, words: 1000, written_words: 120 },
      ],
      today,
    );
    expect(d.todayWords).toBe(120);
    expect(d.streak).toBe(2);
    expect(d.cumulativeLine.at(-1)?.words).toBe(1000);
  });

  it('смешанная история: legacy-дни (written_words: null) и новые дни (written_words: number) сосуществуют корректно', () => {
    const dayBeforeYesterday = toLocalISODate(new Date(2026, 5, 13));
    const d = computeActivityData(
      [
        { date: dayBeforeYesterday, words: 400, written_words: null },
        { date: yesterdayStr, words: 650, written_words: null },
        { date: todayStr, words: 600, written_words: 85 },
      ],
      today,
    );
    expect(d.cells.find(c => c.date === dayBeforeYesterday)?.delta).toBe(400);
    expect(d.cells.find(c => c.date === yesterdayStr)?.delta).toBe(250);
    expect(d.todayWords).toBe(85);
    expect(d.streak).toBe(3);
  });

  it('серия длиннее 31 дня считается полностью в окне 52 недель', () => {
    const snapshots = Array.from({ length: 45 }, (_, idx) => {
      const dt = new Date(today);
      dt.setDate(dt.getDate() - (44 - idx));
      return { date: toLocalISODate(dt), words: (idx + 1) * 100, written_words: 100 };
    });
    const d = computeActivityData(snapshots, today);
    expect(d.streak).toBe(45);
    expect(d.todayWords).toBe(100);
  });
});
