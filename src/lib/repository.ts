import { supabase } from './supabase';

export class DbError extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
    readonly table: string,
  ) {
    super(`[${table}] ${message}`);
    this.name = 'DbError';
  }
}

function toDbError(err: { message: string; code?: string }, table: string): DbError {
  return new DbError(err.message, err.code, table);
}

export interface OrderClause {
  column: string;
  ascending: boolean;
}

export interface Repository<T> {
  list(bookId: string): Promise<T[]>;
  create(bookId: string, userId: string, patch?: Record<string, unknown>): Promise<T>;
  update(id: string, patch: Record<string, unknown>): Promise<T>;
  delete(id: string): Promise<void>;
}

export function createRepository<T>(
  table: string,
  defaults: Record<string, unknown> = {},
  orderBy: OrderClause[] = [{ column: 'created_at', ascending: true }],
): Repository<T> {
  return {
    async list(bookId) {
      const base = supabase.from(table).select('*').eq('book_id', bookId);
      const q = orderBy.reduce((acc, o) => acc.order(o.column, { ascending: o.ascending }), base);
      const { data, error } = await q;
      if (error) throw toDbError(error, table);
      return (data ?? []) as T[];
    },

    async create(bookId, userId, patch = {}) {
      const { data, error } = await supabase
        .from(table)
        .insert({ book_id: bookId, user_id: userId, ...defaults, ...patch })
        .select('*')
        .single();
      if (error) throw toDbError(error, table);
      return data as T;
    },

    async update(id, patch) {
      const { data, error } = await supabase
        .from(table)
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw toDbError(error, table);
      return data as T;
    },

    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw toDbError(error, table);
    },
  };
}
