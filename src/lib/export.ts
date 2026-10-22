import DOMPurify from 'dompurify';
import { isImageUrl } from '../components/CoverPicker';
import { type Book } from './supabase';
import { type Chapter } from './chapters';
import { type Note } from './notes';
import { ROLE_LABELS, type Character } from './characters';
import { TYPE_LABELS, type Location } from './locations';
import { plural } from './i18n';
import { parseHtmlBlocks, runsText, stripXmlInvalid, type Block, type Run } from './exportModel';

export type Format = 'epub' | 'fb2' | 'docx' | 'html' | 'txt' | 'md' | 'pdf';
export type ParagraphStyle = 'indent' | 'spacing' | 'both';

export const LANGUAGES = [
  { value: 'ru-RU', label: 'Русский' },
  { value: 'en-US', label: 'English' },
  { value: 'uk-UA', label: 'Українська' },
] as const;

export const FORMAT_MAIN: { value: Format; label: string; ext: string; desc: string }[] = [
  { value: 'epub', label: 'EPUB', ext: 'epub', desc: 'Электронные читалки' },
  { value: 'fb2', label: 'FB2', ext: 'fb2', desc: 'Русские читалки и pocketbook' },
  { value: 'docx', label: 'DOCX', ext: 'docx', desc: 'Word, для редактора' },
  { value: 'pdf', label: 'PDF', ext: 'pdf', desc: 'Печать · редактор' },
];

export const FORMAT_TEXT: { value: Format; label: string; ext: string; desc?: string }[] = [
  { value: 'html', label: 'HTML', ext: 'html', desc: 'для публикации на сайте' },
  { value: 'md', label: 'Markdown', ext: 'md' },
  { value: 'txt', label: 'TXT', ext: 'txt' },
];

export const FORMAT_EXT: Record<Format, string> = {
  epub: 'epub', fb2: 'fb2', docx: 'docx', html: 'html', md: 'md', txt: 'txt', pdf: 'pdf',
};

/** Форматы только для Pro. */
export const PRO_FORMATS: readonly Format[] = ['epub', 'fb2', 'docx', 'pdf'];
/** Форматы с вёрсткой: в них есть карта мира и выбор стиля абзацев. */
export const LAYOUT_FORMATS: readonly Format[] = ['epub', 'fb2', 'docx', 'html'];

const KIND_LABELS: Record<string, string> = {
  idea: 'Идея', question: 'Вопрос', todo: 'Задача', important: 'Важно',
};

export function noteLabel(n: Note): string {
  return n.kind === 'custom' ? (n.custom_label || 'Заметка') : (KIND_LABELS[n.kind] ?? 'Заметка');
}

export const CHAPTER_NOTES_TITLE = 'Примечания автора';
export const BOOK_NOTES_TITLE = 'Общие примечания автора';

// ─── Utilities ────────────────────────────────────────────────────────────────

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function escapeXml(s: string): string {
  return stripXmlInvalid(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeXmlAttr(s: string): string {
  return escapeXml(s).replace(/"/g, '&quot;');
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^\p{L}0-9\s-]/gu, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') || 'manuscript'
  );
}

export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += chunkSize)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  return btoa(binary);
}

export function scaleToFit(w: number, h: number, maxW: number, maxH: number) {
  const r = Math.min(maxW / w, maxH / h);
  return { width: Math.round(w * r), height: Math.round(h * r) };
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(content: string, mime: string, filename: string) {
  triggerDownload(new Blob([content], { type: `${mime};charset=utf-8` }), filename);
}

// ─── Cover ────────────────────────────────────────────────────────────────────

export interface CoverData {
  data: ArrayBuffer;
  mime: string;
  ext: string;
}

/** Тип изображения по сигнатуре байтов — content-type ответа бывает `application/octet-stream`. */
export function sniffImageMime(buf: ArrayBuffer): string | null {
  const b = new Uint8Array(buf.slice(0, 12));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
    && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

const MIME_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };

export async function fetchCoverData(url: string): Promise<CoverData | undefined> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return undefined;
    const data = await resp.arrayBuffer();
    const mime = sniffImageMime(data);
    if (!mime) return undefined;
    return { data, mime, ext: MIME_EXT[mime] };
  } catch {
    return undefined;
  }
}

async function bitmapToJpeg(bmp: ImageBitmap): Promise<ArrayBuffer> {
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d недоступен');
  // JPEG без альфа-канала: прозрачные области иначе станут чёрными.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, bmp.width, bmp.height);
  ctx.drawImage(bmp, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.9));
  return blob.arrayBuffer();
}

/**
 * EPUB 3.0 и большинство FB2-читалок понимают только JPEG/PNG — WebP и прочее
 * перекодируем в JPEG. Не получилось — обложку пропускаем, а не кладём битую.
 */
export async function toEbookCover(cover: CoverData | undefined): Promise<CoverData | undefined> {
  if (!cover) return undefined;
  if (cover.mime === 'image/jpeg' || cover.mime === 'image/png') return cover;
  try {
    const bmp = await createImageBitmap(new Blob([cover.data], { type: cover.mime }));
    try {
      return { data: await bitmapToJpeg(bmp), mime: 'image/jpeg', ext: 'jpg' };
    } finally {
      bmp.close();
    }
  } catch {
    return undefined;
  }
}

// ─── Appendices: «Действующие лица», «Локации» ───────────────────────────────

export interface AppendixParagraph {
  label?: string;
  text: string;
  italic?: boolean;
}

export interface AppendixEntry {
  title: string;
  meta: string[];
  paragraphs: AppendixParagraph[];
}

export interface Appendix {
  id: 'characters' | 'locations';
  title: string;
  entries: AppendixEntry[];
}

function textParagraphs(text: string | null | undefined, label?: string, italic?: boolean): AppendixParagraph[] {
  const lines = (text ?? '').split(/\n+/).map((l) => l.trim()).filter(Boolean);
  return lines.map((t, i) => ({ text: t, ...(i === 0 && label ? { label } : {}), ...(italic ? { italic } : {}) }));
}

const ROLE_ORDER: Record<string, number> = { protagonist: 0, secondary: 1, minor: 2 };

/**
 * Глоссарий для читателя: имя, роль, возраст, псевдонимы, цитата, внешность и характер.
 * Предыстория, внутренняя жизнь, «разрыв» и рабочие заметки — спойлеры и кухня автора,
 * в книгу не идут.
 */
export function buildCharactersAppendix(characters: Character[]): Appendix | null {
  const entries = [...characters]
    .filter((c) => c.name.trim())
    .sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) || a.position - b.position)
    .map((c): AppendixEntry => {
      const meta = [ROLE_LABELS[c.role] ?? ''];
      if (c.age != null && c.age > 0) meta.push(`${c.age} ${plural(c.age, 'год', 'года', 'лет')}`);
      const aliases = (c.aliases ?? []).map((a) => a.trim()).filter(Boolean);
      if (aliases.length) meta.push(`также: ${aliases.join(', ')}`);
      return {
        title: c.name.trim(),
        meta: meta.filter(Boolean),
        paragraphs: [
          ...textParagraphs(c.quote, undefined, true),
          ...textParagraphs(c.appearance, 'Внешность'),
          ...textParagraphs(c.personality, 'Характер'),
        ],
      };
    });
  return entries.length ? { id: 'characters', title: 'Действующие лица', entries } : null;
}

export function buildLocationsAppendix(locations: Location[]): Appendix | null {
  const entries = [...locations]
    .filter((l) => l.name.trim())
    .sort((a, b) => a.position - b.position)
    .map((l): AppendixEntry => ({
      title: l.name.trim(),
      meta: [l.type !== 'other' ? TYPE_LABELS[l.type] : '', l.role.trim()].filter(Boolean),
      paragraphs: textParagraphs(l.description),
    }));
  return entries.length ? { id: 'locations', title: 'Локации', entries } : null;
}

/** HTML приложения — валиден и как XHTML (всё экранировано, void-тегов нет). */
export function appendixHtml(a: Appendix, headingTag: 'h1' | 'h2' = 'h2'): string {
  const entries = a.entries.map((e) => {
    const meta = e.meta.length ? `<p class="appendix-meta">${escapeHtml(e.meta.join(' · '))}</p>` : '';
    const paras = e.paragraphs.map((p) => {
      const label = p.label ? `<strong>${escapeHtml(p.label)}.</strong> ` : '';
      const text = p.italic ? `<em>${escapeHtml(p.text)}</em>` : escapeHtml(p.text);
      return `<p class="no-indent">${label}${text}</p>`;
    }).join('');
    return `<div class="appendix-entry"><h3>${escapeHtml(e.title)}</h3>${meta}${paras}</div>`;
  }).join('');
  return `<section class="appendix"><${headingTag} class="chapter-title">${escapeHtml(a.title)}</${headingTag}>${entries}</section>`;
}

function appendixPlain(a: Appendix): string {
  return a.entries.map((e) => {
    const head = e.meta.length ? `${e.title} (${e.meta.join(', ')})` : e.title;
    const paras = e.paragraphs.map((p) => (p.label ? `${p.label}. ${p.text}` : p.text));
    return [head, ...paras].join('\n');
  }).join('\n\n');
}

function appendixMarkdown(a: Appendix): string {
  return a.entries.map((e) => {
    const meta = e.meta.length ? `\n\n*${mdEscape(e.meta.join(' · '))}*` : '';
    const paras = e.paragraphs.map((p) => {
      const text = p.italic ? `*${mdEscape(p.text)}*` : mdEscape(p.text);
      return p.label ? `**${mdEscape(p.label)}.** ${text}` : text;
    });
    return [`### ${mdEscape(e.title)}${meta}`, ...paras].join('\n\n');
  }).join('\n\n');
}

// ─── Notes renderers ─────────────────────────────────────────────────────────

export function chapterNotes(notes: Note[], chapterId: string): Note[] {
  return notes.filter((n) => n.chapter_id === chapterId && n.text.trim());
}

/** Заметки без главы: в книге — отдельным разделом в конце, а не теряются. */
export function bookNotes(notes: Note[]): Note[] {
  return notes.filter((n) => !n.chapter_id && n.text.trim());
}

export function notesBlockHtml(notes: Note[], title = CHAPTER_NOTES_TITLE): string {
  if (!notes.length) return '';
  const items = notes.map((n) =>
    `<p class="note-item"><em>${escapeHtml(noteLabel(n))}:</em> ${escapeHtml(n.text)}</p>`
  ).join('');
  return `<div class="chapter-notes"><p class="chapter-notes-title">${escapeHtml(title)}</p>${items}</div>`;
}

function notesPlain(notes: Note[], title = CHAPTER_NOTES_TITLE): string {
  if (!notes.length) return '';
  return `${title}\n` + notes.map((n) => `${noteLabel(n)}: ${n.text}`).join('\n');
}

function notesMarkdown(notes: Note[], title = CHAPTER_NOTES_TITLE): string {
  if (!notes.length) return '';
  return `> **${title}**\n>\n` + notes.map((n) => `> *${mdEscape(noteLabel(n))}:* ${mdEscape(n.text)}`).join('  \n');
}

// ─── Plain builders ───────────────────────────────────────────────────────────

export function addNoIndentToFirst(html: string): string {
  return html.replace(/<p(\s[^>]*)?>/, (match, attrs) => {
    const a = attrs ?? '';
    if (a.includes('class=')) return match.replace(/class="([^"]*)"/, 'class="$1 no-indent"');
    return `<p${a} class="no-indent">`;
  });
}

function getHtmlStyle(paragraphStyle: ParagraphStyle): string {
  const pRule = paragraphStyle === 'indent'
    ? 'p{margin:0 0 0.2em;text-indent:1.4em}p.no-indent{text-indent:0}'
    : paragraphStyle === 'both'
    ? 'p{margin:0 0 0.9em;text-indent:1.4em}p.no-indent{text-indent:0}'
    : 'p{margin:0 0 1.1em;text-indent:0}';
  return `
  body{font:16px/1.7 Georgia,'Times New Roman',serif;max-width:720px;margin:48px auto;padding:0 24px;color:#1a1715;background:#faf8f4}
  h1.book-title{font-size:32px;letter-spacing:-0.01em;margin-bottom:4px}
  .book-meta{color:#6a635c;font:13px/1.5 system-ui,sans-serif;margin-bottom:48px}
  h2.chapter-title{font-size:22px;letter-spacing:-0.01em;margin:56px 0 24px;padding-top:32px;border-top:1px solid #e6dfd4}
  ${pRule}
  blockquote{margin:1.4em 1em;padding-left:1em;border-left:3px solid #c8b89a;color:#4a443f;font-style:italic}
  .chapter-notes{margin:2em 0 0;padding:1em 1.2em;background:#f5f0e8;border-left:3px solid #c8b89a;border-radius:4px}
  .chapter-notes-title{margin:0 0 0.6em;font:600 11px system-ui,sans-serif;color:#8a7d70;text-transform:uppercase;letter-spacing:0.08em}
  .note-item{margin:0 0 0.4em;font-size:14px;color:#4a443f;text-indent:0}
  .appendix-entry{margin:0 0 1.4em}
  .appendix-entry h3{font-size:17px;margin:0 0 0.2em}
  .appendix-meta{margin:0 0 0.4em;color:#6a635c;font-style:italic;text-indent:0}
  .cover-img{display:block;max-width:400px;margin:0 auto 2.5em;border-radius:6px}
  @media print{h2.chapter-title{page-break-before:always}}
`;
}

export interface SeriesInfo {
  name: string;
  number: number | null;
}

export interface BuildOpts {
  includeChapterTitles: boolean;
  includeTitlePage: boolean;
  language: string;
  includeNotes: boolean;
  notes: Note[];
  paragraphStyle: ParagraphStyle;
  cover?: CoverData;
  mapImage?: ArrayBuffer;
  /** Приложения в конце книги («Действующие лица», «Локации») — в порядке вывода. */
  appendices?: Appendix[];
  series?: SeriesInfo;
}

export function buildHtmlDoc(book: Book, chapters: Chapter[], opts: BuildOpts): string {
  const meta = [
    book.author && `Автор: ${escapeHtml(book.author)}`,
    book.genre && `Жанр: ${escapeHtml(book.genre)}`,
  ].filter(Boolean).join(' · ');
  const mapHtml = opts.mapImage
    ? `<div style="margin:2em 0;text-align:center"><img src="data:image/png;base64,${arrayBufferToBase64(opts.mapImage)}" alt="Карта мира" style="max-width:100%;border-radius:6px"/></div>`
    : '';
  const body = chapters.map((ch) => {
    const title = opts.includeChapterTitles ? `<h2 class="chapter-title">${escapeHtml(ch.title)}</h2>` : '';
    const notesHtml = opts.includeNotes ? notesBlockHtml(chapterNotes(opts.notes, ch.id)) : '';
    const sanitized = DOMPurify.sanitize(ch.content || '', { FORBID_TAGS: ['input', 'label'] });
    const content = opts.paragraphStyle !== 'spacing' ? addNoIndentToFirst(sanitized) : sanitized;
    return title + content + notesHtml;
  }).join('\n');
  const bookNotesHtml = opts.includeNotes ? notesBlockHtml(bookNotes(opts.notes), BOOK_NOTES_TITLE) : '';
  const appendices = (opts.appendices ?? []).map((a) => appendixHtml(a)).join('\n');
  return `<!doctype html>
<html lang="${opts.language}">
<head><meta charset="utf-8"><title>${escapeHtml(book.title)}</title><style>${getHtmlStyle(opts.paragraphStyle)}</style></head>
<body>
<h1 class="book-title">${escapeHtml(book.title)}</h1>
${meta ? `<div class="book-meta">${meta}</div>` : ''}
${book.cover && isImageUrl(book.cover) ? `<img class="cover-img" src="${escapeHtml(book.cover)}" alt="${escapeHtml(book.title)}">` : ''}
${mapHtml}${body}
${appendices}
${bookNotesHtml}
</body>
</html>`;
}

// ─── Blocks → TXT / Markdown ──────────────────────────────────────────────────

function blocksToText(blocks: Block[], indent = ''): string {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.kind === 'p' || b.kind === 'heading') {
      const t = runsText(b.runs).trim();
      if (t) out.push(indent + t.replace(/\n/g, '\n' + indent));
    } else if (b.kind === 'quote') {
      const inner = blocksToText(b.blocks, indent + '    ');
      if (inner) out.push(inner);
    } else if (b.kind === 'list') {
      b.items.forEach((item, i) => {
        const marker = b.ordered ? `${b.start + i}. ` : '• ';
        const inner = blocksToText(item, indent + ' '.repeat(marker.length));
        out.push(indent + marker + inner.slice(indent.length + marker.length));
      });
    } else if (b.kind === 'code') {
      out.push(b.lines.map((l) => indent + l).join('\n'));
    } else {
      out.push(indent + '* * *');
    }
  }
  return out.join('\n\n');
}

function mdEscape(s: string): string {
  return s.replace(/([\\*_`[\]])/g, '\\$1');
}

function runsToMarkdown(runs: Run[]): string {
  let out = '';
  for (const r of runs) {
    if (r.kind === 'br') { out += '  \n'; continue; }
    if (r.marks.includes('code')) { out += '`' + r.text.replace(/`/g, '') + '`'; continue; }
    // Пробелы по краям выносим наружу: «** текст**» Markdown не распознаёт.
    const m = r.text.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const [, lead, core, trail] = m ?? ['', '', r.text, ''];
    if (!core) { out += r.text; continue; }
    let t = mdEscape(core);
    if (r.marks.includes('s')) t = `~~${t}~~`;
    if (r.marks.includes('i')) t = `*${t}*`;
    if (r.marks.includes('b')) t = `**${t}**`;
    if (r.marks.includes('sup')) t = `<sup>${t}</sup>`;
    if (r.marks.includes('sub')) t = `<sub>${t}</sub>`;
    if (r.href) t = `[${t}](${r.href})`;
    out += lead + t + trail;
  }
  return out;
}

function blocksToMarkdown(blocks: Block[], headingShift: number): string {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.kind === 'p') {
      const t = runsToMarkdown(b.runs).trim();
      if (t) out.push(t);
    } else if (b.kind === 'heading') {
      const t = runsToMarkdown(b.runs).trim();
      if (t) out.push(`${'#'.repeat(Math.min(6, b.level + headingShift))} ${t}`);
    } else if (b.kind === 'quote') {
      const inner = blocksToMarkdown(b.blocks, headingShift);
      if (inner) out.push(inner.split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n'));
    } else if (b.kind === 'list') {
      const items = b.items.map((item, i) => {
        const marker = b.ordered ? `${b.start + i}. ` : '- ';
        const inner = blocksToMarkdown(item, headingShift);
        const pad = ' '.repeat(marker.length);
        return marker + inner.split('\n').map((l, j) => (j === 0 || !l ? l : pad + l)).join('\n');
      });
      out.push(items.join('\n'));
    } else if (b.kind === 'code') {
      out.push('```\n' + b.lines.join('\n') + '\n```');
    } else {
      out.push('* * *');
    }
  }
  return out.join('\n\n');
}

export function htmlToPlainText(html: string): string {
  return blocksToText(parseHtmlBlocks(html));
}

export function buildTextDoc(book: Book, chapters: Chapter[], opts: BuildOpts): string {
  const header = [book.title, book.author ? `Автор: ${book.author}` : '', book.genre ? `Жанр: ${book.genre}` : ''].filter(Boolean).join('\n');
  const parts = chapters.map((ch) => {
    const text = htmlToPlainText(ch.content || '');
    const notes = opts.includeNotes ? notesPlain(chapterNotes(opts.notes, ch.id)) : '';
    const body = [text, notes].filter(Boolean).join('\n\n');
    if (!opts.includeChapterTitles) return body;
    return `${ch.title}\n${'─'.repeat(Math.max(3, ch.title.length))}\n\n${body}`;
  });
  for (const a of opts.appendices ?? []) parts.push(`${a.title}\n${'─'.repeat(a.title.length)}\n\n${appendixPlain(a)}`);
  if (opts.includeNotes) {
    const bn = notesPlain(bookNotes(opts.notes), BOOK_NOTES_TITLE);
    if (bn) parts.push(bn);
  }
  return [header, ...parts].filter(Boolean).join('\n\n\n').trim() + '\n';
}

export function buildMarkdownDoc(book: Book, chapters: Chapter[], opts: BuildOpts): string {
  const header = `# ${mdEscape(book.title)}\n\n` +
    (book.author ? `*Автор: ${mdEscape(book.author)}*  \n` : '') +
    (book.genre ? `*Жанр: ${mdEscape(book.genre)}*\n` : '');
  // Заголовки внутри главы не выше заголовка главы (##).
  const shift = opts.includeChapterTitles ? 2 : 1;
  const parts = chapters.map((ch) => {
    const md = blocksToMarkdown(parseHtmlBlocks(ch.content || ''), shift);
    const notes = opts.includeNotes ? notesMarkdown(chapterNotes(opts.notes, ch.id)) : '';
    const body = [md, notes].filter(Boolean).join('\n\n');
    if (!opts.includeChapterTitles) return body;
    return `## ${mdEscape(ch.title)}\n\n${body}`;
  });
  for (const a of opts.appendices ?? []) parts.push(`## ${mdEscape(a.title)}\n\n${appendixMarkdown(a)}`);
  if (opts.includeNotes) {
    const bn = notesMarkdown(bookNotes(opts.notes), BOOK_NOTES_TITLE);
    if (bn) parts.push(bn);
  }
  return [header.trim(), ...parts].filter(Boolean).join('\n\n').trim() + '\n';
}

// ─── Size estimate ────────────────────────────────────────────────────────────

export function estimateSize(format: Format, chapters: { words: number; content?: string | null }[]): string {
  const len = chapters.reduce((s, c) => s + (c.content?.length ?? c.words * 5), 0);
  const bytes = Math.round(len * ({ epub: 0.3, fb2: 0.75, docx: 0.6, html: 0.5, md: 0.35, txt: 0.3, pdf: 0 }[format] ?? 0.5)
    + ({ epub: 15000, fb2: 3000, docx: 12000, html: 2000, md: 500, txt: 500, pdf: 0 }[format] ?? 2000));
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `~${Math.round(bytes / 1024)} КБ`;
  return `~${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

// buildFb2Doc re-exported (no heavy deps); buildDocxBlob/buildEpubBlob are dynamic-imported in Export.tsx
export { buildFb2Doc } from './exportFb2';
