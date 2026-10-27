import * as Sentry from './monitoring';
import { ensureAuthReady, storagePathFromPublicUrl, supabase, type Book } from './supabase';
import type { Tables } from './database.types';

export type BookPatch = Partial<
  Pick<Book, 'title' | 'author' | 'genre' | 'genres' | 'words' | 'goal' | 'daily_goal' | 'cover' | 'share_token' | 'map_bg_url' | 'map_template' | 'imported_words'>
>;

export interface BookCreateInput {
  user_id: string;
  title: string;
  genre: string | null;
  genres: string[];
  goal: number;
  words: number;
  cover: string;
  author?: string | null;
}

export async function getBook(id: string): Promise<Book> {
  const { data, error } = await supabase.from('books').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) {
    const err = Object.assign(new Error('Книга не найдена'), { code: 'NOT_FOUND', status: 404 });
    throw err;
  }
  return data as Book;
}

export async function listBooks(): Promise<Book[]> {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Book[];
}

export async function createBook(input: BookCreateInput): Promise<Book> {
  const { data, error } = await supabase.from('books').insert(input).select().single();
  if (error) throw error;
  return data as Book;
}

export type Series = Tables<'series'>;

/** Что переносить из книги-источника в книгу-продолжение. */
export interface SeriesTransferOptions {
  characters: boolean;
  locationsMap: boolean;
  notes: boolean;
  timeline: boolean;
}

export interface BookContentCounts {
  characters: number;
  locations: number;
  notes: number;
  timeline: number;
}

export async function listSeries(): Promise<Series[]> {
  const { data, error } = await supabase.from('series').select('*');
  if (error) throw error;
  return data ?? [];
}

/**
 * Серия создаётся в RPC с названием книги-источника — но название серии и название
 * первого романа совпадают редко. Без этого правка недоступна ниоткуда.
 */
export async function updateSeries(id: string, title: string): Promise<Series> {
  const { data, error } = await supabase
    .from('series')
    .update({ title })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

type CountableTable = 'characters' | 'locations' | 'notes' | 'timeline_events';

async function countRows(table: CountableTable, bookId: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('book_id', bookId);
  if (error) throw error;
  return count ?? 0;
}

/** Счётчики для чекбоксов переноса. Только чтение — Promise.all безопасен. */
export async function getBookContentCounts(bookId: string): Promise<BookContentCounts> {
  const [characters, locations, notes, timeline] = await Promise.all([
    countRows('characters', bookId),
    countRows('locations', bookId),
    countRows('notes', bookId),
    countRows('timeline_events', bookId),
  ]);
  return { characters, locations, notes, timeline };
}

/**
 * Копирует выбранное содержимое книги-источника в книгу-продолжение и связывает
 * обе книги в серию. Атомарно на стороне БД (RPC), с remap ID связей.
 * Книги остаются независимыми: правка/удаление в одной не влияет на другую.
 */
export async function duplicateBookContent(
  sourceBookId: string,
  targetBookId: string,
  userId: string,
  opts: SeriesTransferOptions,
): Promise<void> {
  const { error } = await supabase.rpc('duplicate_book_content', {
    p_source: sourceBookId,
    p_target: targetBookId,
    p_characters: opts.characters,
    p_locations_map: opts.locationsMap,
    p_notes: opts.notes,
    p_timeline: opts.timeline,
  });
  if (error) throw error;
  if (opts.locationsMap) await copyMapBackground(targetBookId, userId);
  if (opts.characters) await copyCharacterAvatars(targetBookId, userId);
}

const AVATAR_BUCKET = 'character-avatars';

// Копии персонажей ссылаются на файлы аватаров оригиналов: удаление аватара в книге-источнике
// удаляло бы картинку и у копии, новая загрузка — меняла бы её. Копируем файлы под id копий
// и одним RPC перешиваем ссылки (upsert нельзя — BEFORE INSERT-триггер лимита Free).
// Как и с фоном карты: сбой не валит создание книги.
async function copyCharacterAvatars(targetBookId: string, userId: string): Promise<void> {
  try {
    const { data: rows, error } = await supabase
      .from('characters')
      .select('id, avatar_url')
      .eq('book_id', targetBookId)
      .not('avatar_url', 'is', null);
    if (error) throw error;
    const jobs = (rows ?? []).flatMap((r) => {
      const src = storagePathFromPublicUrl(r.avatar_url, AVATAR_BUCKET);
      if (!src || src.split('/')[1]?.startsWith(`${r.id}.`)) return [];
      const ext = src.split('.').pop() ?? 'webp';
      return [{ id: r.id, src, dest: `${userId}/${r.id}.${ext}` }];
    });
    if (jobs.length === 0) return;
    await ensureAuthReady();
    const bucket = supabase.storage.from(AVATAR_BUCKET);
    const copied = await Promise.all(jobs.map(async (j) => {
      const { error: copyError } = await bucket.copy(j.src, j.dest);
      if (copyError) { Sentry.captureException(copyError, { tags: { op: 'series-copy-avatar' } }); return null; }
      return [j.id, `${bucket.getPublicUrl(j.dest).data.publicUrl}?t=${Date.now()}`] as const;
    }));
    const map = Object.fromEntries(copied.filter((c) => c !== null));
    if (Object.keys(map).length === 0) return;
    const { error: rpcError } = await supabase.rpc('remap_character_avatars', { p_book: targetBookId, p_map: map });
    if (rpcError) throw rpcError;
  } catch (e) {
    Sentry.captureException(e, { tags: { op: 'series-copy-avatars' } });
  }
}

const MAP_BG_BUCKET = 'map-backgrounds';

// Фон карты у книги один, путь стабилен и перезаписывается при новой загрузке.
export function mapBackgroundPath(userId: string, bookId: string): string {
  return `${userId}/${bookId}/background`;
}

// Удаляем только свой файл книги: у продолжения, созданного до копирования фонов,
// ссылка может вести на файл источника — по своему пути его нет, удалять нечего.
// Фоново: файл без ссылки на него — мусор, а не ошибка для пользователя.
export function removeMapBackgroundFile(userId: string, bookId: string): void {
  void supabase.storage.from(MAP_BG_BUCKET).remove([mapBackgroundPath(userId, bookId)])
    .then(({ error }) => { if (error) Sentry.captureException(error, { tags: { op: 'remove-map-bg' } }); });
}

const CHAPTER_IMAGES_BUCKET = 'chapter-images';
const LIST_PAGE = 100;

// Картинки глав лежат в <user_id>/<book_id>/*, списка путей в БД нет — перечисляем папку.
// Фоново, как и фон карты: сирота в Storage — мусор, а не ошибка для пользователя.
export function removeChapterImageFiles(userId: string, bookId: string): void {
  const folder = `${userId}/${bookId}`;
  const bucket = supabase.storage.from(CHAPTER_IMAGES_BUCKET);
  void (async () => {
    // remove() сдвигает листинг, поэтому каждый раз читаем с начала, пока папка не опустеет.
    for (;;) {
      const { data, error } = await bucket.list(folder, { limit: LIST_PAGE });
      if (error) throw error;
      const files = (data ?? []).filter((f) => f.id);
      if (files.length === 0) return;
      const { data: removed, error: removeError } = await bucket.remove(files.map((f) => `${folder}/${f.name}`));
      if (removeError) throw removeError;
      if (!removed?.length) return;
    }
  })().catch((e) => Sentry.captureException(e, { tags: { op: 'remove-chapter-images' } }));
}

// RPC копирует ссылку на фон карты, а не файл. Путь фона привязан к книге и
// перезаписывается (upsert) — без своей копии новый фон источника менял бы карту продолжения.
// Сбой копирования не валит создание книги: остаётся общая ссылка, как было до фикса.
async function copyMapBackground(targetBookId: string, userId: string): Promise<void> {
  try {
    const { data: book, error } = await supabase.from('books').select('map_bg_url').eq('id', targetBookId).single();
    if (error) throw error;
    const src = storagePathFromPublicUrl(book.map_bg_url, MAP_BG_BUCKET);
    const dest = mapBackgroundPath(userId, targetBookId);
    if (!src || src === dest) return;
    await ensureAuthReady();
    const { error: copyError } = await supabase.storage.from(MAP_BG_BUCKET).copy(src, dest);
    if (copyError) throw copyError;
    const { data } = supabase.storage.from(MAP_BG_BUCKET).getPublicUrl(dest);
    await updateBook(targetBookId, { map_bg_url: `${data.publicUrl}?t=${Date.now()}` });
  } catch (e) {
    Sentry.captureException(e, { tags: { op: 'series-copy-map-bg' } });
  }
}

export async function updateBook(id: string, patch: BookPatch): Promise<Book> {
  const { data, error } = await supabase
    .from('books')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Book;
}

export async function deleteBook(id: string): Promise<void> {
  const { error } = await supabase.from('books').delete().eq('id', id);
  if (error) throw error;
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (userId) {
    removeMapBackgroundFile(userId, id);
    removeChapterImageFiles(userId, id);
  }
}

export type WritingSnapshot = Pick<Tables<'writing_snapshots'>, 'date' | 'words'>;

// Плюс последний снапшот до окна: снапшоты разрежённые, без него база первой клетки = 0
// и у книги старше окна весь объём падает в один день.
export async function listWritingSnapshots(bookId: string, fromDate: string): Promise<WritingSnapshot[]> {
  const [inWindow, before] = await Promise.all([
    supabase
      .from('writing_snapshots')
      .select('date, words')
      .eq('book_id', bookId)
      .gte('date', fromDate)
      .order('date', { ascending: true }),
    supabase
      .from('writing_snapshots')
      .select('date, words')
      .eq('book_id', bookId)
      .lt('date', fromDate)
      .order('date', { ascending: false })
      .limit(1),
  ]);
  if (inWindow.error) throw inWindow.error;
  if (before.error) throw before.error;
  return [...(before.data ?? []), ...(inWindow.data ?? [])] as WritingSnapshot[];
}
