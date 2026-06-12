import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from './supabase';
import { createRepository, DbError } from './repository';

// Chainable builder that resolves to { data, error } when awaited.
function makeBuilder(data: unknown, error: { message: string; code?: string } | null = null) {
  const result = { data, error };
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'not', 'order', 'limit', 'insert', 'update', 'delete', 'upsert']) {
    b[m] = vi.fn(() => b);
  }
  b.single = vi.fn(() => Promise.resolve(result));
  // Make builder awaitable (for `await q` in list())
  b.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return b;
}

const mockFrom = vi.mocked(supabase.from);

beforeEach(() => {
  mockFrom.mockReset();
});

describe('createRepository — list', () => {
  it('returns rows from Supabase', async () => {
    const rows = [{ id: '1', name: 'Алиса' }];
    mockFrom.mockReturnValue(makeBuilder(rows) as never);
    const repo = createRepository<{ id: string; name: string }>('characters');
    await expect(repo.list('book-1')).resolves.toEqual(rows);
  });

  it('applies limit option', async () => {
    const b = makeBuilder([]);
    mockFrom.mockReturnValue(b as never);
    const repo = createRepository('characters');
    await repo.list('book-1', { limit: 10 });
    expect(b.limit as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(10);
  });

  it('omits limit call when option absent', async () => {
    const b = makeBuilder([]);
    mockFrom.mockReturnValue(b as never);
    const repo = createRepository('characters');
    await repo.list('book-1');
    expect(b.limit as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it('throws DbError on Supabase error', async () => {
    mockFrom.mockReturnValue(
      makeBuilder(null, { message: 'relation not found', code: '42P01' }) as never,
    );
    const repo = createRepository('characters');
    await expect(repo.list('book-1')).rejects.toBeInstanceOf(DbError);
  });

  it('DbError carries code and table name', async () => {
    mockFrom.mockReturnValue(
      makeBuilder(null, { message: 'oops', code: '42P01' }) as never,
    );
    const repo = createRepository('notes');
    let caught: unknown;
    try {
      await repo.list('book-1');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(DbError);
    expect((caught as DbError).code).toBe('42P01');
    expect((caught as DbError).table).toBe('notes');
  });

  it('returns empty array when data is null', async () => {
    mockFrom.mockReturnValue(makeBuilder(null) as never);
    const repo = createRepository('characters');
    await expect(repo.list('book-1')).resolves.toEqual([]);
  });
});

describe('createRepository — create', () => {
  it('merges defaults into insert payload', async () => {
    const b = makeBuilder({ id: '2', role: 'main' });
    const insertFn = vi.fn(() => b);
    b.insert = insertFn;
    mockFrom.mockReturnValue(b as never);
    const repo = createRepository('characters', { role: 'main' });
    await repo.create('book-1', 'user-1');
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({ book_id: 'book-1', user_id: 'user-1', role: 'main' }),
    );
  });

  it('patch overrides defaults on conflict', async () => {
    const b = makeBuilder({ id: '3', role: 'side' });
    const insertFn = vi.fn(() => b);
    b.insert = insertFn;
    mockFrom.mockReturnValue(b as never);
    const repo = createRepository('characters', { role: 'main' });
    await repo.create('book-1', 'user-1', { role: 'side' });
    expect(insertFn).toHaveBeenCalledWith(expect.objectContaining({ role: 'side' }));
  });

  it('returns the created record', async () => {
    const record = { id: '4', name: 'Боря' };
    mockFrom.mockReturnValue(makeBuilder(record) as never);
    const repo = createRepository<{ id: string; name: string }>('characters');
    await expect(repo.create('book-1', 'user-1')).resolves.toEqual(record);
  });

  it('throws DbError when insert fails', async () => {
    mockFrom.mockReturnValue(
      makeBuilder(null, { message: 'duplicate key', code: '23505' }) as never,
    );
    const repo = createRepository('characters');
    await expect(repo.create('book-1', 'user-1')).rejects.toBeInstanceOf(DbError);
  });
});

describe('DbError', () => {
  it('is instanceof Error', () => {
    const err = new DbError('row not found', '42P01', 'notes');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(DbError);
  });

  it('exposes code and table properties', () => {
    const err = new DbError('row not found', '42P01', 'notes');
    expect(err.code).toBe('42P01');
    expect(err.table).toBe('notes');
  });

  it('message includes table name', () => {
    const err = new DbError('oops', '500', 'timeline_events');
    expect(err.message).toContain('timeline_events');
  });

  it('handles undefined code', () => {
    const err = new DbError('unknown', undefined, 'books');
    expect(err.code).toBeUndefined();
  });
});
