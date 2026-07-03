import * as Sentry from '@sentry/react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { supabase } from './supabase';

type TableName = keyof Database['public']['Tables'];

// Единственная точка приведения дженерик-репозитория. Имена колонок здесь
// динамические (book_id/id/orderBy/patch) и не выводятся из T, поэтому операции
// идут через нетипизированное представление клиента. Имя таблицы при этом сужено
// до реального (TableName) — опечатка в createRepository ломает сборку.
const db = supabase as unknown as SupabaseClient;

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
  list(bookId: string, options?: { limit?: number }): Promise<T[]>;
  create(bookId: string, userId: string, patch?: Record<string, unknown>): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}

export function createRepository<T>(
  table: TableName,
  defaults: Record<string, unknown> = {},
  orderBy: OrderClause[] = [{ column: 'created_at', ascending: true }],
): Repository<T> {
  return {
    async list(bookId, options = {}) {
      const op = 'list';
      const startMark = `repo.${table}.${op}.start`;
      const endMark = `repo.${table}.${op}.end`;
      const measureName = `repo.${table}.${op}`;
      performance.mark(startMark);
      try {
        const base = db.from(table).select('*').eq('book_id', bookId);
        let q = orderBy.reduce((acc, o) => acc.order(o.column, { ascending: o.ascending }), base);
        if (options.limit) q = q.limit(options.limit);
        const { data, error } = await q;
        if (error) {
          Sentry.addBreadcrumb({ category: 'db', message: `${table}.${op}.error`, level: 'error', data: { code: error.code } });
          throw toDbError(error, table);
        }
        performance.mark(endMark);
        const measure = performance.measure(measureName, startMark, endMark);
        Sentry.addBreadcrumb({ category: 'db', message: `${table}.${op}`, level: 'info', data: { duration: measure.duration } });
        return (data ?? []) as T[];
      } catch (err) {
        if (err instanceof DbError) throw err;
        Sentry.addBreadcrumb({ category: 'db', message: `${table}.${op}.error`, level: 'error', data: { code: (err as { code?: string }).code } });
        throw err;
      }
    },

    async create(bookId, userId, patch = {}) {
      const op = 'create';
      const startMark = `repo.${table}.${op}.start`;
      const endMark = `repo.${table}.${op}.end`;
      const measureName = `repo.${table}.${op}`;
      performance.mark(startMark);
      try {
        const { data, error } = await db
          .from(table)
          .insert({ book_id: bookId, user_id: userId, ...defaults, ...patch })
          .select('*')
          .single();
        if (error) {
          Sentry.addBreadcrumb({ category: 'db', message: `${table}.${op}.error`, level: 'error', data: { code: error.code } });
          throw toDbError(error, table);
        }
        performance.mark(endMark);
        const measure = performance.measure(measureName, startMark, endMark);
        Sentry.addBreadcrumb({ category: 'db', message: `${table}.${op}`, level: 'info', data: { duration: measure.duration } });
        return data as T;
      } catch (err) {
        if (err instanceof DbError) throw err;
        Sentry.addBreadcrumb({ category: 'db', message: `${table}.${op}.error`, level: 'error', data: { code: (err as { code?: string }).code } });
        throw err;
      }
    },

    async update(id, patch) {
      const op = 'update';
      const startMark = `repo.${table}.${op}.start`;
      const endMark = `repo.${table}.${op}.end`;
      const measureName = `repo.${table}.${op}`;
      performance.mark(startMark);
      try {
        const { data, error } = await db
          .from(table)
          .update(patch as Record<string, unknown>)
          .eq('id', id)
          .select('*')
          .single();
        if (error) {
          Sentry.addBreadcrumb({ category: 'db', message: `${table}.${op}.error`, level: 'error', data: { code: error.code } });
          throw toDbError(error, table);
        }
        performance.mark(endMark);
        const measure = performance.measure(measureName, startMark, endMark);
        Sentry.addBreadcrumb({ category: 'db', message: `${table}.${op}`, level: 'info', data: { duration: measure.duration } });
        return data as T;
      } catch (err) {
        if (err instanceof DbError) throw err;
        Sentry.addBreadcrumb({ category: 'db', message: `${table}.${op}.error`, level: 'error', data: { code: (err as { code?: string }).code } });
        throw err;
      }
    },

    async delete(id) {
      const op = 'delete';
      const startMark = `repo.${table}.${op}.start`;
      const endMark = `repo.${table}.${op}.end`;
      const measureName = `repo.${table}.${op}`;
      performance.mark(startMark);
      try {
        const { error } = await db.from(table).delete().eq('id', id);
        if (error) {
          Sentry.addBreadcrumb({ category: 'db', message: `${table}.${op}.error`, level: 'error', data: { code: error.code } });
          throw toDbError(error, table);
        }
        performance.mark(endMark);
        const measure = performance.measure(measureName, startMark, endMark);
        Sentry.addBreadcrumb({ category: 'db', message: `${table}.${op}`, level: 'info', data: { duration: measure.duration } });
      } catch (err) {
        if (err instanceof DbError) throw err;
        Sentry.addBreadcrumb({ category: 'db', message: `${table}.${op}.error`, level: 'error', data: { code: (err as { code?: string }).code } });
        throw err;
      }
    },
  };
}
