import { describe, it, expect, vi, beforeEach } from 'vitest';

type Char = { id: string; avatar_url: string | null };
const { calls, state } = vi.hoisted(() => ({
  calls: { rpc: [] as [string, unknown][], copy: [] as [string, string, string][], update: [] as unknown[], remove: [] as [string, string[]][] },
  state: { mapBgUrl: null as string | null, chars: [] as Char[], failCopy: new Set<string>() },
}));

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));
vi.mock('./supabase', async (importOriginal) => {
  const { storagePathFromPublicUrl } = await importOriginal<typeof import('./supabase')>();
  const PUBLIC = 'https://x.test/storage/v1/object/public';
  // Мини-query builder: books → одна строка с map_bg_url; characters → state.chars с аватаром.
  const from = (table: string) => {
    const b = {
      select: () => b,
      eq: () => b,
      not: () => b,
      delete: () => b,
      update: (patch: unknown) => { calls.update.push(patch); return b; },
      single: async () => ({ data: { id: 'b2', map_bg_url: state.mapBgUrl }, error: null }),
      then: (resolve: (v: unknown) => void) =>
        resolve({ data: table === 'characters' ? state.chars.filter((c) => c.avatar_url) : [], error: null }),
    };
    return b;
  };
  const supabase = {
    rpc: async (name: string, args: unknown) => { calls.rpc.push([name, args]); return { error: null }; },
    from,
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
    storage: {
      from: (bucket: string) => ({
        copy: async (src: string, dest: string) => {
          calls.copy.push([bucket, src, dest]);
          return { error: state.failCopy.has(src) ? new Error('boom') : null };
        },
        remove: async (paths: string[]) => { calls.remove.push([bucket, paths]); return { error: null }; },
        getPublicUrl: (p: string) => ({ data: { publicUrl: `${PUBLIC}/${bucket}/${p}` } }),
      }),
    },
  };
  return { supabase, ensureAuthReady: async () => {}, storagePathFromPublicUrl };
});

import { deleteBook, duplicateBookContent } from './books';
import { storagePathFromPublicUrl } from './supabase';

const OPTS = { characters: true, locationsMap: true, notes: false, timeline: false };
const AV = 'https://x/storage/v1/object/public/character-avatars';

beforeEach(() => {
  calls.rpc = []; calls.copy = []; calls.update = []; calls.remove = [];
  state.mapBgUrl = null; state.chars = []; state.failCopy = new Set();
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
    await duplicateBookContent('b1', 'b2', 'u1', { ...OPTS, characters: false });
    expect(calls.copy).toEqual([['map-backgrounds', 'u1/b1/background', 'u1/b2/background']]);
    expect(calls.update).toHaveLength(1);
    expect(JSON.stringify(calls.update[0])).toContain('map-backgrounds/u1/b2/background?t=');
  });

  it('без фона и без переноса карты — ничего не копирует', async () => {
    await duplicateBookContent('b1', 'b2', 'u1', { ...OPTS, characters: false });
    state.mapBgUrl = 'https://x/public/map-backgrounds/u1/b1/background';
    await duplicateBookContent('b1', 'b2', 'u1', { ...OPTS, characters: false, locationsMap: false });
    expect(calls.copy).toEqual([]);
  });

  it('сбой копирования не валит создание книги', async () => {
    state.mapBgUrl = 'https://x/public/map-backgrounds/u1/b1/background';
    state.failCopy.add('u1/b1/background');
    await expect(duplicateBookContent('b1', 'b2', 'u1', { ...OPTS, characters: false })).resolves.toBeUndefined();
    expect(calls.update).toEqual([]);
  });
});

describe('duplicateBookContent: аватары персонажей', () => {
  it('копирует чужие аватары под id копий и перешивает одним RPC', async () => {
    state.chars = [
      { id: 'n1', avatar_url: `${AV}/u1/o1.webp?t=1` },   // ссылка на файл оригинала → копировать
      { id: 'n2', avatar_url: `${AV}/u1/n2.jpg` },        // уже свой файл → пропустить
      { id: 'n3', avatar_url: null },                      // без аватара
    ];
    await duplicateBookContent('b1', 'b2', 'u1', { ...OPTS, locationsMap: false });
    expect(calls.copy).toEqual([['character-avatars', 'u1/o1.webp', 'u1/n1.webp']]);
    const remap = calls.rpc.find(([name]) => name === 'remap_character_avatars');
    expect(remap?.[1]).toMatchObject({ p_book: 'b2' });
    const map = (remap?.[1] as { p_map: Record<string, string> }).p_map;
    expect(Object.keys(map)).toEqual(['n1']);
    expect(map.n1).toMatch(/character-avatars\/u1\/n1\.webp\?t=\d+$/);
  });

  it('несколько файлов: упавшая копия не попадает в перешивку, остальные — да', async () => {
    state.chars = [
      { id: 'n1', avatar_url: `${AV}/u1/o1.webp` },
      { id: 'n2', avatar_url: `${AV}/u1/o2.webp` },
    ];
    state.failCopy.add('u1/o1.webp');
    await duplicateBookContent('b1', 'b2', 'u1', { ...OPTS, locationsMap: false });
    const map = (calls.rpc.find(([n]) => n === 'remap_character_avatars')?.[1] as { p_map: Record<string, string> }).p_map;
    expect(Object.keys(map)).toEqual(['n2']);
  });

  it('персонажи не переносятся или аватаров нет — RPC перешивки не вызывается', async () => {
    state.chars = [{ id: 'n1', avatar_url: `${AV}/u1/o1.webp` }];
    await duplicateBookContent('b1', 'b2', 'u1', { ...OPTS, characters: false, locationsMap: false });
    state.chars = [];
    await duplicateBookContent('b1', 'b2', 'u1', { ...OPTS, locationsMap: false });
    expect(calls.rpc.map(([n]) => n)).toEqual(['duplicate_book_content', 'duplicate_book_content']);
  });
});

describe('deleteBook: файл фона карты', () => {
  it('после удаления книги удаляет её файл фона', async () => {
    await deleteBook('b9');
    await Promise.resolve();
    expect(calls.remove).toEqual([['map-backgrounds', ['u1/b9/background']]]);
  });
});
