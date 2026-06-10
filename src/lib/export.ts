import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  TextRun,
} from 'docx';
import JSZip from 'jszip';
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

function noteLabel(n: Note): string {
  return n.kind === 'custom' ? (n.custom_label || 'Заметка') : (KIND_LABELS[n.kind] ?? 'Заметка');
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeXml(s: string): string {
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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += chunkSize)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  return btoa(binary);
}

function scaleToFit(w: number, h: number, maxW: number, maxH: number) {
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

function chapterNotes(notes: Note[], chapterId: string): Note[] {
  return notes.filter((n) => n.chapter_id === chapterId);
}

function bookNotes(notes: Note[]): Note[] {
  return notes.filter((n) => !n.chapter_id);
}

function notesBlockHtml(notes: Note[]): string {
  if (!notes.length) return '';
  const items = notes.map((n) =>
    `<p class="note-item"><em>${escapeHtml(noteLabel(n))}:</em> ${escapeHtml(n.text)}</p>`
  ).join('');
  return `<div class="chapter-notes"><p class="chapter-notes-title">Примечания автора</p>${items}</div>`;
}

function notesBlockFb2(notes: Note[]): string {
  if (!notes.length) return '';
  const items = notes.map((n) =>
    `<p><emphasis>${escapeXml(noteLabel(n))}:</emphasis> ${escapeXml(n.text)}</p>`
  ).join('\n');
  return `<cite>\n<subtitle>Примечания автора</subtitle>\n${items}\n</cite>`;
}

// ─── Plain builders ───────────────────────────────────────────────────────────

function addNoIndentToFirst(html: string): string {
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

// ─── DOCX builder ─────────────────────────────────────────────────────────────

interface InlineFmt {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
}

function collectRuns(node: Node, fmt: InlineFmt): TextRun[] {
  const runs: TextRun[] = [];
  const visit = (n: Node, f: InlineFmt) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const text = n.textContent ?? '';
      if (text) runs.push(new TextRun({ text, bold: f.bold, italics: f.italics, underline: f.underline ? {} : undefined, strike: f.strike, font: f.code ? 'Courier New' : undefined }));
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const el = n as Element;
    const tag = el.tagName.toLowerCase();
    if (tag === 'br') { runs.push(new TextRun({ break: 1 })); return; }
    const nf: InlineFmt = { ...f };
    if (tag === 'strong' || tag === 'b') nf.bold = true;
    if (tag === 'em' || tag === 'i') nf.italics = true;
    if (tag === 'u') nf.underline = true;
    if (tag === 's' || tag === 'del' || tag === 'strike') nf.strike = true;
    if (tag === 'code') nf.code = true;
    for (const child of n.childNodes) visit(child, nf);
  };
  for (const child of node.childNodes) visit(child, fmt);
  return runs;
}

const H_LEVELS = [
  HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6,
];

function parseBlockEl(el: Element, paragraphStyle: ParagraphStyle, indentLeft?: number): Paragraph[] {
  const tag = el.tagName.toLowerCase();

  if (tag === 'p') {
    const runs = collectRuns(el, {});
    const hasIndent = paragraphStyle === 'indent' || paragraphStyle === 'both';
    const isNoIndent = el.getAttribute('data-no-indent') === 'true';
    const useFirstLine = hasIndent && !indentLeft && !isNoIndent;
    const spacingAfter = paragraphStyle === 'spacing' ? 200 : paragraphStyle === 'both' ? 160 : 40;
    return [new Paragraph({
      children: runs.length ? runs : [new TextRun('')],
      indent: {
        ...(indentLeft ? { left: indentLeft } : {}),
        ...(useFirstLine ? { firstLine: 720 } : {}),
      },
      spacing: { after: spacingAfter },
    })];
  }

  if (/^h[1-6]$/.test(tag)) {
    return [new Paragraph({ heading: H_LEVELS[parseInt(tag[1], 10) - 1] ?? HeadingLevel.HEADING_1, children: collectRuns(el, {}) })];
  }

  if (tag === 'blockquote') {
    const result: Paragraph[] = [];
    for (const child of Array.from(el.children)) result.push(...parseBlockEl(child, paragraphStyle, 720));
    return result;
  }

  if (tag === 'ul') {
    return Array.from(el.querySelectorAll(':scope > li')).map((li) => {
      const content = li.querySelector('p') ?? li;
      return new Paragraph({ children: collectRuns(content, {}), bullet: { level: 0 } });
    });
  }

  if (tag === 'ol') {
    return Array.from(el.querySelectorAll(':scope > li')).map((li, i) => {
      const content = li.querySelector('p') ?? li;
      return new Paragraph({ children: [new TextRun({ text: `${i + 1}.\t` }), ...collectRuns(content, {})], indent: { left: 360 } });
    });
  }

  if (tag === 'hr') {
    return [new Paragraph({ children: [new TextRun({ text: '* * *' })], alignment: AlignmentType.CENTER, spacing: { before: 240, after: 240 } })];
  }

  const result: Paragraph[] = [];
  for (const child of Array.from(el.children)) result.push(...parseBlockEl(child, paragraphStyle, indentLeft));
  return result;
}

function parseHtmlToParagraphs(html: string, paragraphStyle: ParagraphStyle): Paragraph[] {
  if (!html.trim()) return [];
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.querySelector('div')!;
  const firstP = root.querySelector('p');
  if (firstP) firstP.setAttribute('data-no-indent', 'true');
  const result: Paragraph[] = [];
  for (const child of Array.from(root.children)) result.push(...parseBlockEl(child, paragraphStyle));
  return result;
}

function notesParagraphs(notes: Note[]): Paragraph[] {
  if (!notes.length) return [];
  const result: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_3,
      children: [new TextRun('Примечания автора')],
      spacing: { before: 480, after: 120 },
    }),
  ];
  for (const n of notes) {
    result.push(new Paragraph({
      children: [
        new TextRun({ text: `${noteLabel(n)}: `, bold: true, italics: true }),
        new TextRun({ text: n.text, italics: true }),
      ],
      spacing: { after: 60 },
      indent: { left: 360 },
    }));
  }
  return result;
}

export async function buildDocxBlob(book: Book, chapters: Chapter[], opts: BuildOpts): Promise<Blob> {
  const children: Paragraph[] = [];

  if (opts.cover && opts.cover.ext !== 'webp') {
    let coverW = 400, coverH = 600;
    try {
      const coverBlob = new Blob([opts.cover.data], { type: opts.cover.mime });
      const bmp = await createImageBitmap(coverBlob);
      ({ width: coverW, height: coverH } = scaleToFit(bmp.width, bmp.height, 500, 750));
      bmp.close();
    } catch { /* fallback 400×600 */ }
    const docxImgType = opts.cover.ext === 'png' ? 'png' : 'jpg';
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ data: opts.cover.data, transformation: { width: coverW, height: coverH }, type: docxImgType })],
        spacing: { before: 720, after: 720 },
      }),
      new Paragraph({ children: [new PageBreak()] }),
    );
  }

  if (opts.mapImage) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ data: opts.mapImage, transformation: { width: 594, height: 334 }, type: 'png' })],
        spacing: { before: 360, after: 360 },
      }),
      new Paragraph({ children: [new PageBreak()] }),
    );
  }

  if (opts.includeTitlePage) {
    children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(book.title)], alignment: AlignmentType.CENTER, spacing: { after: 480 } }));
    if (book.author) children.push(new Paragraph({ children: [new TextRun({ text: book.author, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 120 } }));
    if (book.genre) children.push(new Paragraph({ children: [new TextRun({ text: book.genre, italics: true, size: 24 })], alignment: AlignmentType.CENTER, spacing: { after: 480 } }));
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Оглавление')] }));
    for (const ch of chapters) {
      children.push(new Paragraph({ children: [new TextRun(ch.title)], indent: { left: 360 }, spacing: { after: 60 } }));
    }
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    if (i > 0 || opts.includeTitlePage) children.push(new Paragraph({ children: [new PageBreak()] }));
    if (opts.includeChapterTitles) {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(ch.title)] }));
    }
    const body = parseHtmlToParagraphs(ch.content ?? '', opts.paragraphStyle);
    children.push(...(body.length ? body : [new Paragraph({ children: [new TextRun('')] })]));
    if (opts.includeNotes) children.push(...notesParagraphs(chapterNotes(opts.notes, ch.id)));
  }

  if (opts.includeNotes) {
    const bn = bookNotes(opts.notes);
    if (bn.length) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(...notesParagraphs(bn));
    }
  }

  return Packer.toBlob(new Document({ sections: [{ properties: {}, children }] }));
}

// ─── FB2 builder ──────────────────────────────────────────────────────────────

function inlineToFb2(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeXml(node.textContent ?? '');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  const inner = Array.from(el.childNodes).map(inlineToFb2).join('');
  if (tag === 'strong' || tag === 'b') return `<strong>${inner}</strong>`;
  if (tag === 'em' || tag === 'i') return `<emphasis>${inner}</emphasis>`;
  if (tag === 's' || tag === 'del') return `<strikethrough>${inner}</strikethrough>`;
  if (tag === 'code') return `<code>${inner}</code>`;
  if (tag === 'br') return '\n';
  return inner;
}

function blockToFb2(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (tag === 'p') return `<p>${Array.from(el.childNodes).map(inlineToFb2).join('')}</p>`;
  if (/^h[1-6]$/.test(tag)) return `<subtitle>${Array.from(el.childNodes).map(inlineToFb2).join('')}</subtitle>`;
  if (tag === 'blockquote') return `<cite>\n${Array.from(el.children).map(blockToFb2).join('\n')}\n</cite>`;
  if (tag === 'ul') {
    return Array.from(el.querySelectorAll(':scope > li')).map((li) => {
      const p = li.querySelector('p') ?? li;
      return `<p>• ${Array.from(p.childNodes).map(inlineToFb2).join('')}</p>`;
    }).join('\n');
  }
  if (tag === 'ol') {
    return Array.from(el.querySelectorAll(':scope > li')).map((li, i) => {
      const p = li.querySelector('p') ?? li;
      return `<p>${i + 1}. ${Array.from(p.childNodes).map(inlineToFb2).join('')}</p>`;
    }).join('\n');
  }
  if (tag === 'hr') return `<p><emphasis>* * *</emphasis></p>`;
  return Array.from(el.children).map(blockToFb2).join('\n');
}

function htmlToFb2Content(html: string): string {
  if (!html.trim()) return '<p> </p>';
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  return Array.from(doc.querySelector('div')!.children).map(blockToFb2).join('\n');
}

export function buildFb2Doc(book: Book, chapters: Chapter[], opts: BuildOpts): string {
  const mapSection = opts.mapImage
    ? `\n<section>\n<title><p>Карта мира</p></title>\n<image l:href="#map-img"/>\n</section>`
    : '';
  const mapBinary = opts.mapImage
    ? `\n<binary id="map-img" content-type="image/png">\n${arrayBufferToBase64(opts.mapImage)}\n</binary>`
    : '';
  const today = new Date().toISOString().slice(0, 10);
  const [firstName, ...rest] = (book.author ?? '').split(' ');
  const lastName = rest.join(' ');
  const sections = chapters.map((ch) => {
    const title = opts.includeChapterTitles ? `<title><p>${escapeXml(ch.title)}</p></title>\n` : '';
    const notesBlock = opts.includeNotes ? notesBlockFb2(chapterNotes(opts.notes, ch.id)) : '';
    return `<section>\n${title}${htmlToFb2Content(ch.content ?? '')}${notesBlock ? '\n' + notesBlock : ''}\n</section>`;
  }).join('\n');
  const bookNotesBlock = opts.includeNotes && bookNotes(opts.notes).length
    ? `\n<section>\n<title><p>Примечания автора</p></title>\n${notesBlockFb2(bookNotes(opts.notes))}\n</section>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"
             xmlns:l="http://www.w3.org/1999/xlink">
<description>
  <title-info>
    <genre>other</genre>
    <author>
      <first-name>${escapeXml(firstName)}</first-name>
      <last-name>${escapeXml(lastName)}</last-name>
    </author>
    <book-title>${escapeXml(book.title)}</book-title>
    <lang>${opts.language.split('-')[0]}</lang>
    <date value="${today}">${today}</date>
    ${opts.cover ? `<coverpage><image l:href="#cover-img"/></coverpage>` : ''}
  </title-info>
  <document-info>
    <program-used>Авторская студия</program-used>
    <date value="${today}">${today}</date>
  </document-info>
</description>
<body>
${opts.includeTitlePage ? `<title><p>${escapeXml(book.title)}</p>${book.author ? `<p>${escapeXml(book.author)}</p>` : ''}</title>\n` : ''}${mapSection}${sections}${bookNotesBlock}
</body>
${opts.cover ? `<binary id="cover-img" content-type="${opts.cover.mime}">
${arrayBufferToBase64(opts.cover.data)}
</binary>` : ''}${mapBinary}
</FictionBook>`;
}

// ─── EPUB builder ─────────────────────────────────────────────────────────────

function getEpubCss(paragraphStyle: ParagraphStyle): string {
  const pRule = paragraphStyle === 'indent'
    ? 'p{margin:0 0 0.15em;text-indent:1.4em}\np.no-indent{text-indent:0}'
    : paragraphStyle === 'both'
    ? 'p{margin:0 0 0.9em;text-indent:1.4em}\np.no-indent{text-indent:0}'
    : 'p{margin:0 0 1.1em;text-indent:0}\np.no-indent{text-indent:0}';
  return `body{font:1em/1.75 Georgia,'Times New Roman',serif;margin:1.5em 2em}
h1,h2,h3{font-weight:600;margin:1.5em 0 0.5em;line-height:1.3}
h1.title{font-size:2em;text-align:center;margin-top:4em}
.meta{text-align:center;color:#666;margin-bottom:4em}
${pRule}
blockquote{margin:1em 2em;font-style:italic;border-left:3px solid #bbb;padding-left:1em}
strong{font-weight:bold}em{font-style:italic}
.chapter-notes{margin:2em 0 0;padding:0.8em 1em;background:#f5f0e8;border-left:3px solid #c8b89a}
.chapter-notes-title{margin:0 0 0.5em;font-size:0.75em;color:#8a7d70;text-transform:uppercase;letter-spacing:0.08em;font-weight:600}
.note-item{margin:0 0 0.35em;font-size:0.88em;color:#4a443f;text-indent:0}
`;
}

function notesBlockEpub(notes: Note[]): string {
  if (!notes.length) return '';
  const items = notes.map((n) =>
    `<p class="note-item"><em>${escapeHtml(noteLabel(n))}:</em> ${escapeHtml(n.text)}</p>`
  ).join('');
  return `<div class="chapter-notes"><p class="chapter-notes-title">Примечания автора</p>${items}</div>`;
}

function chapterXhtml(title: string, html: string, lang: string, includeTitle: boolean, notesHtml = ''): string {
  const heading = includeTitle ? `<h2>${escapeHtml(title)}</h2>\n  ` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${lang}" xml:lang="${lang}">
<head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head>
<body><section>${heading}${html || '<p> </p>'}${notesHtml}</section></body>
</html>`;
}

function titleXhtml(book: Book, lang: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${lang}" xml:lang="${lang}">
<head><meta charset="utf-8"/><title>${escapeHtml(book.title)}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head>
<body>
  <section>
    <h1 class="title">${escapeHtml(book.title)}</h1>
    <div class="meta">
      ${book.author ? `<p>${escapeHtml(book.author)}</p>` : ''}
      ${book.genre ? `<p><em>${escapeHtml(book.genre)}</em></p>` : ''}
    </div>
  </section>
</body>
</html>`;
}

export async function buildEpubBlob(book: Book, chapters: Chapter[], opts: BuildOpts): Promise<Blob> {
  const uuid = crypto.randomUUID?.() ?? `book-${Date.now()}`;
  const hasCover = !!opts.cover;
  const coverMime = opts.cover?.mime ?? 'image/jpeg';
  const coverExt = opts.cover?.ext ?? 'jpg';
  const today = new Date().toISOString().slice(0, 10);
  const lang = opts.language;

  const chs = chapters.map((ch, i) => ({
    id: `ch${String(i + 1).padStart(3, '0')}`,
    href: `ch${String(i + 1).padStart(3, '0')}.xhtml`,
    title: ch.title,
    content: ch.content ?? '',
    chapterId: ch.id,
  }));

  const hasBookNotes = opts.includeNotes && bookNotes(opts.notes).length > 0;
  const hasMap = !!opts.mapImage;

  const manifestParts = [
    ...(hasCover ? [
      `<item id="cover-image" href="images/cover.${coverExt}" media-type="${coverMime}" properties="cover-image"/>`,
      `<item id="cover-xhtml" href="cover.xhtml" media-type="application/xhtml+xml"/>`,
    ] : []),
    `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="css" href="styles.css" media-type="text/css"/>`,
    ...(opts.includeTitlePage ? [`<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>`] : []),
    ...(hasMap ? [
      `<item id="map-image" href="images/map.png" media-type="image/png"/>`,
      `<item id="map-xhtml" href="map.xhtml" media-type="application/xhtml+xml"/>`,
    ] : []),
    ...chs.map((c) => `<item id="${c.id}" href="${c.href}" media-type="application/xhtml+xml"/>`),
    ...(hasBookNotes ? [`<item id="booknotes" href="notes.xhtml" media-type="application/xhtml+xml"/>`] : []),
  ];
  const spineParts = [
    ...(hasCover ? [`<itemref idref="cover-xhtml"/>`] : []),
    ...(opts.includeTitlePage ? [`<itemref idref="title"/>`] : []),
    ...(hasMap ? [`<itemref idref="map-xhtml"/>`] : []),
    ...chs.map((c) => `<itemref idref="${c.id}"/>`),
    ...(hasBookNotes ? [`<itemref idref="booknotes"/>`] : []),
  ];

  let po = 1;
  const navLi: string[] = [];
  const ncxPts: string[] = [];

  if (hasCover) {
    navLi.push(`<li><a href="cover.xhtml">Обложка</a></li>`);
    ncxPts.push(`<navPoint id="cover-xhtml" playOrder="${po++}"><navLabel><text>Обложка</text></navLabel><content src="cover.xhtml"/></navPoint>`);
  }
  if (opts.includeTitlePage) {
    navLi.push(`<li><a href="title.xhtml">${escapeHtml(book.title)}</a></li>`);
    ncxPts.push(`<navPoint id="title" playOrder="${po++}"><navLabel><text>${escapeXml(book.title)}</text></navLabel><content src="title.xhtml"/></navPoint>`);
  }
  if (hasMap) {
    navLi.push(`<li><a href="map.xhtml">Карта мира</a></li>`);
    ncxPts.push(`<navPoint id="map-xhtml" playOrder="${po++}"><navLabel><text>Карта мира</text></navLabel><content src="map.xhtml"/></navPoint>`);
  }
  for (const c of chs) {
    navLi.push(`<li><a href="${c.href}">${escapeHtml(c.title)}</a></li>`);
    ncxPts.push(`<navPoint id="${c.id}" playOrder="${po++}"><navLabel><text>${escapeXml(c.title)}</text></navLabel><content src="${c.href}"/></navPoint>`);
  }
  if (hasBookNotes) {
    navLi.push(`<li><a href="notes.xhtml">Примечания автора</a></li>`);
    ncxPts.push(`<navPoint id="booknotes" playOrder="${po++}"><navLabel><text>Примечания автора</text></navLabel><content src="notes.xhtml"/></navPoint>`);
  }

  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:identifier id="uid">urn:uuid:${uuid}</dc:identifier>
  <dc:title>${escapeXml(book.title)}</dc:title>
  ${book.author ? `<dc:creator>${escapeXml(book.author)}</dc:creator>` : ''}
  <dc:language>${lang}</dc:language>
  <dc:date>${today}</dc:date>
  <meta property="dcterms:modified">${today}T00:00:00Z</meta>
  ${hasCover ? `<meta name="cover" content="cover-image"/>` : ''}
</metadata>
<manifest>\n  ${manifestParts.join('\n  ')}\n</manifest>
<spine toc="ncx">\n  ${spineParts.join('\n  ')}\n</spine>
</package>`;

  const nav = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${lang}" xml:lang="${lang}">
<head><meta charset="utf-8"/><title>Оглавление</title></head>
<body><nav epub:type="toc"><h1>Оглавление</h1><ol>${navLi.map((l) => `\n  ${l}`).join('')}\n</ol></nav></body>
</html>`;

  const ncx = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head><meta name="dtb:uid" content="urn:uuid:${uuid}"/><meta name="dtb:depth" content="1"/></head>
<docTitle><text>${escapeXml(book.title)}</text></docTitle>
<navMap>${ncxPts.map((p) => `\n  ${p}`).join('')}\n</navMap>
</ncx>`;

  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`);
  zip.file('OEBPS/content.opf', opf);
  zip.file('OEBPS/nav.xhtml', nav);
  zip.file('OEBPS/toc.ncx', ncx);
  zip.file('OEBPS/styles.css', getEpubCss(opts.paragraphStyle));
  if (hasCover && opts.cover) {
    zip.file(`OEBPS/images/cover.${coverExt}`, opts.cover.data);
    zip.file('OEBPS/cover.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><meta charset="utf-8"/><title>Обложка</title>
<style>body{margin:0;padding:0}img{display:block;width:100%;height:100vh;object-fit:contain}</style>
</head>
<body><img src="images/cover.${coverExt}" alt="Обложка"/></body>
</html>`);
  }
  if (opts.includeTitlePage) zip.file('OEBPS/title.xhtml', titleXhtml(book, lang));
  if (hasMap && opts.mapImage) {
    zip.file('OEBPS/images/map.png', opts.mapImage);
    zip.file('OEBPS/map.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${lang}" xml:lang="${lang}">
<head><meta charset="utf-8"/><title>Карта мира</title>
<style>body{margin:0;padding:1em}img{display:block;max-width:100%;border-radius:4px}</style>
</head>
<body><section><h2>Карта мира</h2><img src="images/map.png" alt="Карта мира"/></section></body>
</html>`);
  }
  for (const c of chs) {
    const nHtml = opts.includeNotes ? notesBlockEpub(chapterNotes(opts.notes, c.chapterId)) : '';
    const content = opts.paragraphStyle !== 'spacing' ? addNoIndentToFirst(c.content) : c.content;
    zip.file(`OEBPS/${c.href}`, chapterXhtml(c.title, content, lang, opts.includeChapterTitles, nHtml));
  }

  if (opts.includeNotes) {
    const bn = bookNotes(opts.notes);
    if (bn.length) {
      const bnHtml = notesBlockEpub(bn);
      const bnXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${lang}" xml:lang="${lang}">
<head><meta charset="utf-8"/><title>Примечания автора</title><link rel="stylesheet" type="text/css" href="styles.css"/></head>
<body><section><h2>Примечания автора</h2>${bnHtml}</section></body>
</html>`;
      zip.file('OEBPS/notes.xhtml', bnXhtml);
    }
  }

  return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
}

// ─── Size estimate ────────────────────────────────────────────────────────────

export function estimateSize(format: Format, chapters: Chapter[]): string {
  const len = chapters.reduce((s, c) => s + (c.content?.length ?? 0), 0);
  const bytes = Math.round(len * ({ epub: 0.65, fb2: 0.75, docx: 0.6, html: 0.5, md: 0.35, txt: 0.3 }[format] ?? 0.5)
    + ({ epub: 15000, fb2: 3000, docx: 12000, html: 2000, md: 500, txt: 500 }[format] ?? 2000));
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `~${Math.round(bytes / 1024)} КБ`;
  return `~${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}
