import { describe, it, expect, vi } from 'vitest';

type Row = { date: string; words: number; written_words?: number | null };

const selectCalls: string[] = [];

// Мини-эмуляция query builder: фильтры gte/lt, сортировка, limit — над таблицей в памяти.
function makeBuilder(rows: Row[]) {
  let result = [...rows];
  const b = {
    select: (cols: string) => { selectCalls.push(cols); return b; },
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

const { table, rpcMock } = vi.hoisted(() => ({
  table: [] as Row[],
  rpcMock: vi.fn(),
}));
vi.mock('./supabase', () => ({ supabase: { from: () => makeBuilder(table), rpc: rpcMock } }));

import { listWritingSnapshots, recordWritingProgress } from './books';

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
    selectCalls.length = 0;
    table.splice(0, table.length, { date: '2025-06-01', words: 500, written_words: 42 });
    expect(await listWritingSnapshots('book', '2025-01-01')).toEqual([{ date: '2025-06-01', words: 500, written_words: 42 }]);
    expect(selectCalls).toEqual(['date, words, written_words', 'date, words, written_words']);
  });
});

describe('recordWritingProgress', () => {
  it('вызывает RPC record_writing_progress с локальной датой, типом документа и дельтой', async () => {
    rpcMock.mockReset().mockResolvedValueOnce({ data: 120, error: null });
    const written = await recordWritingProgress({
      bookId: 'b1',
      date: '2026-11-28',
      docKind: 'chapter',
      docId: 'c1',
      delta: 20,
    });
    expect(written).toBe(120);
    expect(rpcMock).toHaveBeenCalledWith('record_writing_progress', {
      p_book_id: 'b1',
      p_date: '2026-11-28',
      p_doc_kind: 'chapter',
      p_doc_id: 'c1',
      p_delta: 20,
    });
  });

  it('пробрасывает ошибку RPC', async () => {
    rpcMock.mockReset().mockResolvedValueOnce({ data: null, error: new Error('unauthorized') });
    await expect(
      recordWritingProgress({
        bookId: 'b1',
        date: '2026-11-28',
        docKind: 'draft',
        docId: 'd1',
        delta: 10,
      }),
    ).rejects.toThrow('unauthorized');
  });
});
