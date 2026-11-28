import { supabase } from './supabase';
import type { Tables } from './database.types';
import type { ChapterType } from './chapterNumbering';

export type ChapterStatus = 'draft' | 'progress' | 'done';
export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

// Выведено из БД (Tables<'chapters'>); status сужен до union.
export type Chapter = Omit<Tables<'chapters'>, 'status'> & { status: ChapterStatus };

export type ChapterMeta = Omit<Chapter, 'content'>;
export type ChapterPatch = Partial<Pick<Chapter, 'title' | 'content' | 'words' | 'status' | 'position' | 'synopsis'>>;

export interface ChapterActions {
  onSelectChapter?: (id: string) => void;
  onCreateChapter?: () => void;
  onStatusChange?: (id: string, status: ChapterStatus) => void;
  onTypeChange?: (id: string, type: ChapterType) => void;
  onDeleteChapter?: (id: string) => void;
  onChapterHover?: (id: string) => void;
}

export const READING_WPM = 200;

const BLOCK_TAG_RE = /<\/?(?:p|div|h[1-6]|li|ul|ol|blockquote|br|hr|td|th|tr|table|thead|tbody|tfoot|pre|img|section|article|header|footer|aside|figure|figcaption|dt|dd|dl)(?:\s[^>]*)?\/?>/gi;
const INVISIBLE_CHARS_RE = /[\u00AD\u200B\u200C\u200D\uFEFF]/g;
const HTML_ENTITY_RE = /&(?:#x([0-9a-f]+)|#(\d+)|([a-z][a-z0-9]*));/gi;

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  shy: '',
  zerowidthspace: '',
  zwnj: '',
  zwj: '',
  nbhy: '\u2011',
  mdash: '—',
  ndash: '–',
  minus: '−',
  hellip: '…',
  laquo: '«',
  raquo: '»',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  bdquo: '„',
  copy: '©',
  reg: '®',
  trade: '™',
  thinsp: ' ',
  ensp: ' ',
  emsp: ' ',
  // Часто встречающиеся латинские буквы с диакритикой в импортированном HTML
  aacute: 'á', agrave: 'à', acirc: 'â', atilde: 'ã', auml: 'ä', aring: 'å', aelig: 'æ',
  ccedil: 'ç',
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë',
  iacute: 'í', igrave: 'ì', icirc: 'î', iuml: 'ï',
  ntilde: 'ñ',
  oacute: 'ó', ograve: 'ò', ocirc: 'ô', otilde: 'õ', ouml: 'ö', oslash: 'ø', oelig: 'œ',
  uacute: 'ú', ugrave: 'ù', ucirc: 'û', uuml: 'ü',
  yacute: 'ý', yuml: 'ÿ',
  szlig: 'ß',
};

function decodeHtmlEntity(match: string, hex?: string, dec?: string, named?: string): string {
  if (hex) {
    const code = parseInt(hex, 16);
    if (code === 0x00AD || code === 0x200B || code === 0x200C || code === 0x200D || code === 0xFEFF) return '';
    return Number.isFinite(code) && code >= 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : ' ';
  }
  if (dec) {
    const code = parseInt(dec, 10);
    if (code === 173 || code === 8203 || code === 8204 || code === 8205 || code === 65279) return '';
    return Number.isFinite(code) && code >= 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : ' ';
  }
  if (named) {
    const lower = named.toLowerCase();
    if (lower in NAMED_ENTITIES) return NAMED_ENTITIES[lower];
    return ' ';
  }
  return match;
}

export function countWords(html: string): number {
  if (!html) return 0;
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(BLOCK_TAG_RE, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(HTML_ENTITY_RE, decodeHtmlEntity)
    .replace(INVISIBLE_CHARS_RE, '');
  const matches = text.match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['’\-\u2011][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*/gu);
  return matches ? matches.length : 0;
}

export function countChars(html: string): number {
  if (!html) return 0;
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(HTML_ENTITY_RE, decodeHtmlEntity)
    .replace(INVISIBLE_CHARS_RE, '');
  return text.length;
}

// Полный список с контентом — только для экспорта/focus/split
export async function listChapters(bookId: string): Promise<Chapter[]> {
  const { data, error } = await supabase
    .from('chapters')
    .select('*')
    .eq('book_id', bookId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Chapter[];
}

const META_COLUMNS = 'id, book_id, user_id, title, position, synopsis, words, status, created_at, updated_at';

// Только метаданные — для сайдбара, списков, дашборда (без контента)
export async function listChaptersMeta(bookId: string): Promise<ChapterMeta[]> {
  const { data, error } = await supabase
    .from('chapters')
    .select(META_COLUMNS)
    .eq('book_id', bookId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChapterMeta[];
}

// Контент конкретной главы — загружать только при открытии
export async function getChapterContent(id: string): Promise<{ id: string; content: string }> {
  const { data, error } = await supabase
    .from('chapters')
    .select('id, content')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as { id: string; content: string };
}

export async function createChapter(
  bookId: string,
  userId: string,
  patch: { title?: string; position?: number; content?: string; words?: number } = {},
): Promise<Chapter> {
  const { data, error } = await supabase
    .from('chapters')
    .insert({
      book_id: bookId,
      user_id: userId,
      title: patch.title ?? 'Без названия',
      position: patch.position ?? 0,
      ...(patch.content !== undefined && { content: patch.content }),
      ...(patch.words !== undefined && { words: patch.words }),
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Chapter;
}

// Прокси Supabase на VPS принимает тело запроса до 5 МБ (client_max_body_size в nginx).
const BULK_BATCH_BYTES = 3 * 1024 * 1024;

export interface ChapterBulkItem {
  title: string;
  content?: string;
  words?: number;
  synopsis?: string;
  position?: number;
}

/**
 * Массовая вставка глав (импорт рукописи или инициализация структуры):
 * строго требует bookId, userId и список элементов единой схемы.
 */
export async function createChaptersBulk(
  bookId: string,
  userId: string,
  items: ChapterBulkItem[],
): Promise<ChapterMeta[]> {
  const rows = items.map((it, i) => ({
    book_id: bookId,
    user_id: userId,
    title: it.title,
    content: it.content ?? '',
    words: it.words ?? 0,
    synopsis: it.synopsis ?? '',
    position: it.position ?? i,
  }));

  const batches: (typeof rows)[] = [];
  let cur: typeof rows = [];
  let size = 0;
  for (const r of rows) {
    const s = new Blob([JSON.stringify(r)]).size;
    if (cur.length && size + s > BULK_BATCH_BYTES) { batches.push(cur); cur = []; size = 0; }
    cur.push(r);
    size += s;
  }
  if (cur.length) batches.push(cur);
  const out: ChapterMeta[] = [];
  for (const batch of batches) {
    const { data, error } = await supabase
      .from('chapters')
      .insert(batch)
      .select('id, book_id, user_id, title, position, synopsis, words, status, created_at, updated_at');
    if (error) throw error;
    out.push(...((data ?? []) as ChapterMeta[]));
  }
  return out.sort((a, b) => a.position - b.position);
}

export async function updateChapter(id: string, patch: ChapterPatch): Promise<Chapter> {
  const { data, error } = await supabase
    .from('chapters')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Chapter;
}

// Автосохранение: в ответ только метаданные (без эха контента — источник правды
// для текста в редакторе, а не ответ сервера). С expectedUpdatedAt — оптимистичная
// блокировка: null = 0 строк, глава изменилась (или удалена) с момента загрузки.
export async function updateChapterMeta(
  id: string,
  patch: ChapterPatch,
  expectedUpdatedAt?: string | null,
): Promise<ChapterMeta | null> {
  let q = supabase.from('chapters').update(patch).eq('id', id);
  if (expectedUpdatedAt) q = q.eq('updated_at', expectedUpdatedAt);
  const { data, error } = await q.select(META_COLUMNS).maybeSingle();
  if (error) throw error;
  return (data as ChapterMeta | null) ?? null;
}

export async function getChapterState(id: string): Promise<{ content: string; updated_at: string } | null> {
  const { data, error } = await supabase
    .from('chapters')
    .select('content, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteChapter(id: string): Promise<void> {
  const { error } = await supabase.from('chapters').delete().eq('id', id);
  if (error) throw error;
}

export async function reorderChapters(updates: { id: string; position: number }[]): Promise<void> {
  if (updates.length === 0) return;
  const { error } = await supabase.rpc('reorder_chapters', { updates });
  if (error) throw error;
}

export async function renumberChapters(updates: Array<{ id: string; title: string; book_id?: string; user_id?: string }>): Promise<void> {
  if (updates.length === 0) return;
  const results = await Promise.all(updates.map((u) => supabase.from('chapters').update({ title: u.title }).eq('id', u.id)));
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}
