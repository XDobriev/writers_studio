import { isImageUrl } from '../components/CoverPicker';
import { type Book } from './supabase';
import { type Chapter } from './chapters';
import { type Note } from './notes';
import { htmlToText } from './htmlUtils';

export type Format = 'epub' | 'fb2' | 'docx' | 'html' | 'txt' | 'md';
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
];

export const FORMAT_TEXT: { value: Format; label: string; ext: string; desc?: string }[] = [
  { value: 'html', label: 'HTML', ext: 'html', desc: 'для публикации на сайте' },
  { value: 'md', label: 'Markdown', ext: 'md' },
  { value: 'txt', label: 'TXT', ext: 'txt' },
];

export const FORMAT_EXT: Record<Format, string> = {
  epub: 'epub', fb2: 'fb2', docx: 'docx', html: 'html', md: 'md', txt: 'txt',
};

const KIND_LABELS: Record<string, string> = {
  idea: 'Идея', question: 'Вопрос', todo: 'Задача', important: 'Важно',
};

export function noteLabel(n: Note): string {
  return n.kind === 'custom' ? (n.custom_label || 'Заметка') : (KIND_LABELS[n.kind] ?? 'Заметка');
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-zа-яё0-9\s-]/gi, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') || 'manuscript'
  );
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
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

// ─── HTML → Text / Markdown ───────────────────────────────────────────────────

function htmlToMarkdown(html: string): string {
  let s = html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n\n');
  s = s.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n\n');
  s = s.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n\n');
  s = s.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi, '**$2**');
  s = s.replace(/<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi, '_$2_');
  s = s.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_: string, inner: string) => '\n> ' + htmlToText(inner) + '\n\n');
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&[a-z0-9#]+;/gi, '');
  return s.replace(/\n{3,}/g, '\n\n').trim();
}

// ─── Notes renderers ─────────────────────────────────────────────────────────

export function chapterNotes(notes: Note[], chapterId: string): Note[] {
  return notes.filter((n) => n.chapter_id === chapterId);
}

export function bookNotes(notes: Note[]): Note[] {
  return notes.filter((n) => !n.chapter_id);
}

export function notesBlockHtml(notes: Note[]): string {
  if (!notes.length) return '';
  const items = notes.map((n) =>
    `<p class="note-item"><em>${escapeHtml(noteLabel(n))}:</em> ${escapeHtml(n.text)}</p>`
  ).join('');
  return `<div class="chapter-notes"><p class="chapter-notes-title">Примечания автора</p>${items}</div>`;
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
  .cover-img{display:block;max-width:400px;margin:0 auto 2.5em;border-radius:6px}
  @media print{h2.chapter-title{page-break-before:always}}
`;
}

export interface CoverData {
  data: ArrayBuffer;
  mime: string;
  ext: string;
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
    const content = opts.paragraphStyle !== 'spacing' ? addNoIndentToFirst(ch.content || '') : (ch.content || '');
    return title + content + notesHtml;
  }).join('\n');
  const bookNotesHtml = opts.includeNotes ? notesBlockHtml(bookNotes(opts.notes)) : '';
  return `<!doctype html>
<html lang="${opts.language}">
<head><meta charset="utf-8"><title>${escapeHtml(book.title)}</title><style>${getHtmlStyle(opts.paragraphStyle)}</style></head>
<body>
<h1 class="book-title">${escapeHtml(book.title)}</h1>
${meta ? `<div class="book-meta">${meta}</div>` : ''}
${book.cover && isImageUrl(book.cover) ? `<img class="cover-img" src="${escapeHtml(book.cover)}" alt="${escapeHtml(book.title)}">` : ''}
${mapHtml}${body}
${bookNotesHtml}
</body>
</html>`;
}

export function buildTextDoc(book: Book, chapters: Chapter[], opts: BuildOpts): string {
  const header = [book.title, book.author ? `Автор: ${book.author}` : '', book.genre ? `Жанр: ${book.genre}` : ''].filter(Boolean).join('\n');
  const body = chapters.map((ch) => {
    const text = htmlToText(ch.content || '');
    if (!opts.includeChapterTitles) return text;
    return `\n\n${ch.title}\n${'─'.repeat(ch.title.length)}\n\n${text}`;
  }).join('\n');
  return `${header}\n${body}\n`.trim() + '\n';
}

export function buildMarkdownDoc(book: Book, chapters: Chapter[], opts: BuildOpts): string {
  const header = `# ${book.title}\n\n` +
    (book.author ? `*Автор: ${book.author}*  \n` : '') +
    (book.genre ? `*Жанр: ${book.genre}*\n` : '') + '\n';
  const body = chapters.map((ch) => {
    const md = htmlToMarkdown(ch.content || '');
    if (!opts.includeChapterTitles) return md;
    return `\n## ${ch.title}\n\n${md}`;
  }).join('\n');
  return `${header}${body}\n`.trim() + '\n';
}

// ─── Size estimate ────────────────────────────────────────────────────────────

export function estimateSize(format: Format, chapters: { words: number; content?: string | null }[]): string {
  const len = chapters.reduce((s, c) => s + (c.content?.length ?? c.words * 5), 0);
  const bytes = Math.round(len * ({ epub: 0.65, fb2: 0.75, docx: 0.6, html: 0.5, md: 0.35, txt: 0.3 }[format] ?? 0.5)
    + ({ epub: 15000, fb2: 3000, docx: 12000, html: 2000, md: 500, txt: 500 }[format] ?? 2000));
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `~${Math.round(bytes / 1024)} КБ`;
  return `~${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

// Re-exports — backward compatibility
export { buildDocxBlob } from './exportDocx';
export { buildFb2Doc } from './exportFb2';
export { buildEpubBlob } from './exportEpub';
