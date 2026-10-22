import { describe, it, expect, vi } from 'vitest';

type Row = { date: string; words: number };

// Мини-эмуляция query builder: фильтры gte/lt, сортировка, limit — над таблицей в памяти.
function makeBuilder(rows: Row[]) {
  let result = [...rows];
  const b = {
    select: () => b,
    eq: () => b,
    gte: (_: string, v: string) => { result = result.filter((r) => r.date >= v); return b; },
    lt: (_: string, v: string) => { result = result.filter((r) => r.date < v); return b; },
    order: (_: string, o: { ascending: boolean }) => {
      result.sort((x, y) => (o.ascending ? x.date.localeCompare(y.date) : y.date.localeCompare(x.date)));
      return b;
    },
    limit: (n: number) => { result = result.slice(0, n); return b; },
    then: (resolve: (v: { data: Row[]; error: null }) => void) => resolve({ data: result, error: null }),
  };
  return b;
}

const { table } = vi.hoisted(() => ({ table: [] as Row[] }));
vi.mock('./supabase', () => ({ supabase: { from: () => makeBuilder(table) } }));

import { listWritingSnapshots } from './books';

describe('listWritingSnapshots', () => {
  it('добавляет последний снапшот до окна — база для первой клетки heatmap', async () => {
    table.splice(0, table.length,
      { date: '2024-01-10', words: 1000 },
      { date: '2024-05-01', words: 40000 },
      { date: '2025-06-01', words: 41000 },
    );
    const rows = await listWritingSnapshots('book', '2025-01-01');
    expect(rows).toEqual([
      { date: '2024-05-01', words: 40000 },
      { date: '2025-06-01', words: 41000 },
    ]);
  });

  it('нет снапшотов до окна — только окно', async () => {
    table.splice(0, table.length, { date: '2025-06-01', words: 500 });
    expect(await listWritingSnapshots('book', '2025-01-01')).toEqual([{ date: '2025-06-01', words: 500 }]);
  });
});
