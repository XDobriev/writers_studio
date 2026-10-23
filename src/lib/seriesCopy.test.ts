import { describe, it, expect, vi, beforeEach } from 'vitest';

const { calls, state } = vi.hoisted(() => ({
  calls: { rpc: [] as unknown[], copy: [] as [string, string][], update: [] as unknown[] },
  state: { mapBgUrl: null as string | null, copyError: null as Error | null },
}));

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));
vi.mock('./supabase', async (importOriginal) => {
  const { storagePathFromPublicUrl } = await importOriginal<typeof import('./supabase')>();
  const PUBLIC = 'https://x.test/storage/v1/object/public';
  const books = {
    select: () => books,
    eq: () => books,
    single: async () => ({ data: { map_bg_url: state.mapBgUrl }, error: null }),
    update: (patch: unknown) => { calls.update.push(patch); return books; },
  };
  const supabase = {
    rpc: async (...args: unknown[]) => { calls.rpc.push(args); return { error: null }; },
    from: () => ({ ...books, select: () => ({ ...books, single: async () => ({ data: { id: 'b2', map_bg_url: state.mapBgUrl }, error: null }) }) }),
    storage: {
      from: (bucket: string) => ({
        copy: async (src: string, dest: string) => { calls.copy.push([src, dest]); return { error: state.copyError }; },
        getPublicUrl: (p: string) => ({ data: { publicUrl: `${PUBLIC}/${bucket}/${p}` } }),
      }),
    },
  };
  return { supabase, ensureAuthReady: async () => {}, storagePathFromPublicUrl };
});

import { duplicateBookContent } from './books';
import { storagePathFromPublicUrl } from './supabase';

const OPTS = { characters: true, locationsMap: true, notes: false, timeline: false };

beforeEach(() => {
  calls.rpc = []; calls.copy = []; calls.update = [];
  state.mapBgUrl = null; state.copyError = null;
});

describe('storagePathFromPublicUrl', () => {
  it('путь без ?t= и с раскодированием', () => {
    expect(storagePathFromPublicUrl('https://x/storage/v1/object/public/map-backgrounds/u1/b1/background?t=5', 'map-backgrounds'))
      .toBe('u1/b1/background');
    expect(storagePathFromPublicUrl('https://x/public/character-avatars/u1/%D0%90.webp', 'character-avatars')).toBe('u1/А.webp');
  });
  it('чужой бакет или пусто → null', () => {
    expect(storagePathFromPublicUrl('https://x/public/book-covers/u1/c.webp', 'map-backgrounds')).toBeNull();
    expect(storagePathFromPublicUrl(null, 'map-backgrounds')).toBeNull();
  });
});

describe('duplicateBookContent: фон карты', () => {
  it('копирует файл фона в папку новой книги', async () => {
    state.mapBgUrl = 'https://x/storage/v1/object/public/map-backgrounds/u1/b1/background?t=1';
    await duplicateBookContent('b1', 'b2', 'u1', OPTS);
    expect(calls.copy).toEqual([['u1/b1/background', 'u1/b2/background']]);
    expect(calls.update).toHaveLength(1);
    expect(JSON.stringify(calls.update[0])).toContain('map-backgrounds/u1/b2/background?t=');
  });

  it('без фона и без переноса карты — ничего не копирует', async () => {
    await duplicateBookContent('b1', 'b2', 'u1', OPTS);
    state.mapBgUrl = 'https://x/public/map-backgrounds/u1/b1/background';
    await duplicateBookContent('b1', 'b2', 'u1', { ...OPTS, locationsMap: false });
    expect(calls.copy).toEqual([]);
    expect(calls.rpc).toHaveLength(2);
  });

  it('сбой копирования не валит создание книги', async () => {
    state.mapBgUrl = 'https://x/public/map-backgrounds/u1/b1/background';
    state.copyError = new Error('boom');
    await expect(duplicateBookContent('b1', 'b2', 'u1', OPTS)).resolves.toBeUndefined();
    expect(calls.update).toEqual([]);
  });
});
