import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useErrorState } from '../lib/useErrorState';
import { useAuth } from '../lib/auth';
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  TextRun,
} from 'docx';
import JSZip from 'jszip';
import { Icon } from '../components/Icon';
import { type Book } from '../lib/supabase';
import { getBook } from '../lib/books';
import { listChapters, type Chapter } from '../lib/chapters';
import { fetchNotes, type Note } from '../lib/notes';

type Format = 'epub' | 'fb2' | 'docx' | 'html' | 'txt' | 'md';

const LANGUAGES = [
  { value: 'ru-RU', label: 'Русский' },
  { value: 'en-US', label: 'English' },
  { value: 'uk-UA', label: 'Українська' },
] as const;

const FORMAT_MAIN: { value: Format; label: string; ext: string; desc: string }[] = [
  { value: 'epub', label: 'EPUB', ext: 'epub', desc: 'Электронные читалки' },
  { value: 'fb2', label: 'FB2', ext: 'fb2', desc: 'Русские читалки и pocketbook' },
  { value: 'docx', label: 'DOCX', ext: 'docx', desc: 'Word, для редактора' },
];

const FORMAT_TEXT: { value: Format; label: string; ext: string; desc?: string }[] = [
  { value: 'html', label: 'HTML', ext: 'html', desc: 'для публикации на сайте' },
  { value: 'md', label: 'Markdown', ext: 'md' },
  { value: 'txt', label: 'TXT', ext: 'txt' },
];

const FORMAT_EXT: Record<Format, string> = {
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

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-zа-яё0-9\s-]/gi, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') || 'manuscript'
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadText(content: string, mime: string, filename: string) {
  triggerDownload(new Blob([content], { type: `${mime};charset=utf-8` }), filename);
}

// ─── HTML → Text / Markdown ───────────────────────────────────────────────────

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&[a-z0-9#]+;/gi, '')
    .replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
}

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

function getHtmlStyle(paragraphStyle: 'indent' | 'spacing'): string {
  const pRule = paragraphStyle === 'indent'
    ? 'p{margin:0 0 0.2em;text-indent:1.4em}p.no-indent,p:first-of-type{text-indent:0}'
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
`;
}

interface BuildOpts {
  includeChapterTitles: boolean;
  includeTitlePage: boolean;
  language: string;
  includeNotes: boolean;
  notes: Note[];
  paragraphStyle: 'indent' | 'spacing';
}

function buildHtmlDoc(book: Book, chapters: Chapter[], opts: BuildOpts): string {
  const meta = [
    book.author && `Автор: ${escapeHtml(book.author)}`,
    book.genre && `Жанр: ${escapeHtml(book.genre)}`,
  ].filter(Boolean).join(' · ');
  const body = chapters.map((ch) => {
    const title = opts.includeChapterTitles ? `<h2 class="chapter-title">${escapeHtml(ch.title)}</h2>` : '';
    const notesHtml = opts.includeNotes ? notesBlockHtml(chapterNotes(opts.notes, ch.id)) : '';
    return title + (ch.content || '') + notesHtml;
  }).join('\n');
  const bookNotesHtml = opts.includeNotes ? notesBlockHtml(bookNotes(opts.notes)) : '';
  return `<!doctype html>
<html lang="${opts.language}">
<head><meta charset="utf-8"><title>${escapeHtml(book.title)}</title><style>${getHtmlStyle(opts.paragraphStyle)}</style></head>
<body>
<h1 class="book-title">${escapeHtml(book.title)}</h1>
${meta ? `<div class="book-meta">${meta}</div>` : ''}
${body}
${bookNotesHtml}
</body>
</html>`;
}

function buildTextDoc(book: Book, chapters: Chapter[], opts: BuildOpts): string {
  const header = [book.title, book.author ? `Автор: ${book.author}` : '', book.genre ? `Жанр: ${book.genre}` : ''].filter(Boolean).join('\n');
  const body = chapters.map((ch) => {
    const text = htmlToText(ch.content || '');
    if (!opts.includeChapterTitles) return text;
    return `\n\n${ch.title}\n${'─'.repeat(ch.title.length)}\n\n${text}`;
  }).join('\n');
  return `${header}\n${body}\n`.trim() + '\n';
}

function buildMarkdownDoc(book: Book, chapters: Chapter[], opts: BuildOpts): string {
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

function parseBlockEl(el: Element, paragraphStyle: 'indent' | 'spacing', indentLeft?: number): Paragraph[] {
  const tag = el.tagName.toLowerCase();

  if (tag === 'p') {
    const runs = collectRuns(el, {});
    const useFirstLine = paragraphStyle === 'indent' && !indentLeft;
    return [new Paragraph({
      children: runs.length ? runs : [new TextRun('')],
      indent: {
        ...(indentLeft ? { left: indentLeft } : {}),
        ...(useFirstLine ? { firstLine: 720 } : {}),
      },
      spacing: paragraphStyle === 'indent' ? { after: 40 } : { after: 200 },
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

function parseHtmlToParagraphs(html: string, paragraphStyle: 'indent' | 'spacing'): Paragraph[] {
  if (!html.trim()) return [];
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.querySelector('div')!;
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

async function buildDocxBlob(book: Book, chapters: Chapter[], opts: BuildOpts): Promise<Blob> {
  const children: Paragraph[] = [];

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

function buildFb2Doc(book: Book, chapters: Chapter[], opts: BuildOpts): string {
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
  </title-info>
  <document-info>
    <program-used>Авторская студия</program-used>
    <date value="${today}">${today}</date>
  </document-info>
</description>
<body>
${opts.includeTitlePage ? `<title><p>${escapeXml(book.title)}</p>${book.author ? `<p>${escapeXml(book.author)}</p>` : ''}</title>\n` : ''}${sections}${bookNotesBlock}
</body>
</FictionBook>`;
}

// ─── EPUB builder ─────────────────────────────────────────────────────────────

function getEpubCss(paragraphStyle: 'indent' | 'spacing'): string {
  const pRule = paragraphStyle === 'indent'
    ? 'p{margin:0 0 0.15em;text-indent:1.4em}\np.no-indent,p:first-of-type{text-indent:0}'
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

async function buildEpubBlob(book: Book, chapters: Chapter[], opts: BuildOpts): Promise<Blob> {
  const uuid = crypto.randomUUID?.() ?? `book-${Date.now()}`;
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

  const manifestParts = [
    `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="css" href="styles.css" media-type="text/css"/>`,
    ...(opts.includeTitlePage ? [`<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>`] : []),
    ...chs.map((c) => `<item id="${c.id}" href="${c.href}" media-type="application/xhtml+xml"/>`),
    ...(hasBookNotes ? [`<item id="booknotes" href="notes.xhtml" media-type="application/xhtml+xml"/>`] : []),
  ];
  const spineParts = [
    ...(opts.includeTitlePage ? [`<itemref idref="title"/>`] : []),
    ...chs.map((c) => `<itemref idref="${c.id}"/>`),
    ...(hasBookNotes ? [`<itemref idref="booknotes"/>`] : []),
  ];

  let po = 1;
  const navLi: string[] = [];
  const ncxPts: string[] = [];

  if (opts.includeTitlePage) {
    navLi.push(`<li><a href="title.xhtml">${escapeHtml(book.title)}</a></li>`);
    ncxPts.push(`<navPoint id="title" playOrder="${po++}"><navLabel><text>${escapeXml(book.title)}</text></navLabel><content src="title.xhtml"/></navPoint>`);
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
  if (opts.includeTitlePage) zip.file('OEBPS/title.xhtml', titleXhtml(book, lang));
  for (const c of chs) {
    const nHtml = opts.includeNotes ? notesBlockEpub(chapterNotes(opts.notes, c.chapterId)) : '';
    zip.file(`OEBPS/${c.href}`, chapterXhtml(c.title, c.content, lang, opts.includeChapterTitles, nHtml));
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

function estimateSize(format: Format, chapters: Chapter[]): string {
  const len = chapters.reduce((s, c) => s + (c.content?.length ?? 0), 0);
  const bytes = Math.round(len * ({ epub: 0.65, fb2: 0.75, docx: 0.6, html: 0.5, md: 0.35, txt: 0.3 }[format] ?? 0.5)
    + ({ epub: 15000, fb2: 3000, docx: 12000, html: 2000, md: 500, txt: 500 }[format] ?? 2000));
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `~${Math.round(bytes / 1024)} КБ`;
  return `~${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Export() {
  const { id: bookId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const { error, setError, clearError } = useErrorState();
  const [authorName, setAuthorName] = useState('');
  const authorInitialized = useRef(false);

  const [format, setFormat] = useState<Format>('epub');
  const [doneOnly, setDoneOnly] = useState(false);
  const [includeChapterTitles, setIncludeChapterTitles] = useState(true);
  const [includeTitlePage, setIncludeTitlePage] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [language, setLanguage] = useState('ru-RU');
  const [langOpen, setLangOpen] = useState(false);
  const [langPos, setLangPos] = useState({ top: 0, left: 0, width: 0 });
  const langBtnRef = useRef<HTMLButtonElement>(null);
  const [paragraphStyle, setParagraphStyle] = useState<'indent' | 'spacing'>(() =>
    (localStorage.getItem('export-paragraph-style') as 'indent' | 'spacing') ?? 'indent'
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    (async () => {
      try {
        const [book, list, notesList] = await Promise.all([
          getBook(bookId),
          listChapters(bookId),
          fetchNotes(bookId),
        ]);
        if (cancelled) return;
        setBook(book);
        setChapters(list);
        setNotes(notesList);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [bookId, setError]);

  // Инициализируем автора из книги или профиля пользователя (однократно)
  useEffect(() => {
    if (!book || authorInitialized.current) return;
    const meta = user?.user_metadata ?? {};
    const profileName = (meta.full_name ?? meta.name ?? meta.first_name ?? '') as string;
    setAuthorName(book.author || profileName);
    authorInitialized.current = true;
  }, [book, user]);

  const close = useCallback(() => {
    navigate(bookId ? `/books/${bookId}` : '/books');
  }, [bookId, navigate]);

  const selectedChapters = useMemo(() => {
    if (!chapters) return [];
    const list = doneOnly ? chapters.filter((c) => c.status === 'done') : chapters;
    return [...list].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
  }, [chapters, doneOnly]);

  const totalWords = useMemo(() => selectedChapters.reduce((s, c) => s + c.words, 0), [selectedChapters]);

  const filename = useMemo(() => {
    if (!book) return '';
    return `${slugify(book.title)}-${new Date().toISOString().slice(0, 10)}.${FORMAT_EXT[format]}`;
  }, [book, format]);

  const onDownload = useCallback(async () => {
    if (!book) return;
    if (selectedChapters.length === 0) { setError('Нет глав для экспорта.'); return; }
    setBusy(true);
    clearError();
    const bookWithAuthor = { ...book, author: authorName.trim() || book.author };
    const opts: BuildOpts = { includeChapterTitles, includeTitlePage, language, includeNotes, notes, paragraphStyle };
    try {
      if (format === 'docx') {
        triggerDownload(await buildDocxBlob(bookWithAuthor, selectedChapters, opts), filename);
      } else if (format === 'epub') {
        triggerDownload(await buildEpubBlob(bookWithAuthor, selectedChapters, opts), filename);
      } else if (format === 'fb2') {
        downloadText(buildFb2Doc(bookWithAuthor, selectedChapters, opts), 'application/xml', filename);
      } else if (format === 'html') {
        downloadText(buildHtmlDoc(bookWithAuthor, selectedChapters, opts), 'text/html', filename);
      } else if (format === 'md') {
        downloadText(buildMarkdownDoc(bookWithAuthor, selectedChapters, opts), 'text/markdown', filename);
      } else {
        downloadText(buildTextDoc(bookWithAuthor, selectedChapters, opts), 'text/plain', filename);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [book, authorName, selectedChapters, format, includeChapterTitles, includeTitlePage, includeNotes, notes, language, paragraphStyle, filename, setError, clearError]);

  if (!bookId) return <Navigate to="/books" replace />;

  if (error && !book) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', padding: 32 }}>
        <div style={{ color: 'var(--danger)', marginBottom: 16 }}>Ошибка: {error}</div>
        <button className="btn" onClick={close}>← К дэшборду</button>
      </div>
    );
  }

  if (!book || !chapters) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg-deep)', display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}>
        Загрузка…
      </div>
    );
  }

  const doneCnt = chapters.filter((c) => c.status === 'done').length;
  const downloadLabel = busy ? 'Генерация…' : `Скачать ${FORMAT_MAIN.find((f) => f.value === format)?.label ?? format.toUpperCase()}`;

  return (
    <div className="as" style={{ minHeight: '100vh', background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: 680, maxWidth: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '22px 28px 18px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 4 }}>Экспорт книги</div>
            <h2 style={{ font: '600 22px var(--font-serif)', letterSpacing: '-0.01em', color: 'var(--ink)' }}>
              {book.title} · {totalWords.toLocaleString('ru-RU')} слов
            </h2>
          </div>
          <button onClick={close} style={{ width: 30, height: 30, borderRadius: 999, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '20px 28px 8px' }}>

          {/* Main format cards */}
          <div style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Формат</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            {FORMAT_MAIN.map((o) => {
              const active = o.value === format;
              return (
                <button
                  key={o.value}
                  onClick={() => setFormat(o.value)}
                  style={{
                    padding: '14px 16px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                    border: active ? '1px solid var(--accent)' : '1px solid var(--border-soft)',
                    background: active ? 'var(--accent-soft)' : 'var(--surface)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 14, height: 14, borderRadius: 999, border: '1.5px solid ' + (active ? 'var(--accent)' : 'var(--border-strong)'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {active && <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)' }} />}
                    </span>
                    <span style={{ font: '500 14px var(--font-serif)', color: 'var(--ink)' }}>{o.label}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.4 }}>{o.desc}</div>
                </button>
              );
            })}
          </div>

          {/* Text formats strip */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border-soft)' }}>
            {FORMAT_TEXT.map((o) => {
              const active = o.value === format;
              return (
                <button
                  key={o.value}
                  onClick={() => setFormat(o.value)}
                  style={{
                    padding: '4px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                    border: active ? '1px solid var(--accent)' : '1px solid var(--border-soft)',
                    background: active ? 'var(--accent-soft)' : 'var(--surface)',
                    color: active ? 'var(--ink)' : 'var(--ink-3)',
                    font: '500 12px var(--font-mono)',
                  }}
                >
                  {o.label}
                </button>
              );
            })}
            <span style={{ fontSize: 11, color: 'var(--ink-4)', alignSelf: 'center', marginLeft: 4 }}>
              {FORMAT_TEXT.find(f => f.value === format)?.desc ?? 'текстовые форматы'}
            </span>
          </div>

          {/* Metadata */}
          <div style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Метаданные</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {/* Название */}
            <div style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8 }}>
              <div style={{ font: '400 10px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Название</div>
              <div style={{ fontSize: 13.5, color: 'var(--ink)' }}>{book.title}</div>
            </div>
            {/* Автор — редактируемый */}
            <div style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8 }}>
              <div style={{ font: '400 10px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Автор</div>
              <input
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Имя автора…"
                style={{ background: 'none', border: 'none', padding: 0, margin: 0, fontSize: 13.5, color: 'var(--ink)', width: '100%', outline: 'none', fontFamily: 'inherit' }}
              />
            </div>
            {/* Жанр */}
            <div style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8 }}>
              <div style={{ font: '400 10px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Жанр</div>
              <div style={{ fontSize: 13.5, color: 'var(--ink)' }}>{book.genre || '—'}</div>
            </div>
            <div style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8 }}>
              <div style={{ font: '400 10px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Язык</div>
              <button
                ref={langBtnRef}
                type="button"
                onClick={() => {
                  if (langOpen) { setLangOpen(false); return; }
                  const r = langBtnRef.current!.getBoundingClientRect();
                  setLangPos({ top: r.bottom + 4, left: r.left, width: r.width });
                  setLangOpen(true);
                }}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: '100%', textAlign: 'left', fontSize: 13.5, color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'inherit', outline: 'none' }}
              >
                <span>{LANGUAGES.find(l => l.value === language)?.label}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ink-3)', flexShrink: 0 }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Toggles */}
          <div style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Включить</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 12 }}>
            <ToggleRow
              label={`Все ${chapters.length} ${pluralChapters(chapters.length)} (готовых: ${doneCnt} из ${chapters.length})`}
              hint={doneOnly ? `— только готовые (${doneCnt})` : undefined}
              on={!doneOnly}
              onChange={(v) => setDoneOnly(!v)}
            />
            <ToggleRow
              label="Титульная страница и оглавление"
              on={includeTitlePage}
              onChange={setIncludeTitlePage}
            />
            <ToggleRow
              label="Заголовки глав внутри документа"
              on={includeChapterTitles}
              onChange={setIncludeChapterTitles}
            />
            <ToggleRow
              label="Заметки на полях как примечания автора"
              hint={notes.length ? `— ${notes.length} ${pluralNotes(notes.length)}` : '— нет заметок'}
              on={includeNotes && notes.length > 0}
              onChange={(v) => notes.length > 0 && setIncludeNotes(v)}
              disabled={notes.length === 0}
              last
            />
          </div>

          {/* Paragraph style — rich formats only */}
          {(['epub', 'fb2', 'docx', 'html'] as Format[]).includes(format) && (
            <div style={{ paddingTop: 16, marginBottom: 4 }}>
              <div style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Стиль абзацев</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {([
                  { value: 'indent', label: '⊢ Красная строка', hint: 'отступ первой строки' },
                  { value: 'spacing', label: '¶ Интервал', hint: 'отступ между абзацами' },
                ] as { value: 'indent' | 'spacing'; label: string; hint: string }[]).map((s) => {
                  const active = paragraphStyle === s.value;
                  return (
                    <button
                      key={s.value}
                      onClick={() => { setParagraphStyle(s.value); localStorage.setItem('export-paragraph-style', s.value); }}
                      style={{
                        padding: '6px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                        border: active ? '1px solid var(--accent)' : '1px solid var(--border-soft)',
                        background: active ? 'var(--accent-soft)' : 'var(--surface)',
                      }}
                    >
                      <div style={{ font: `500 12.5px var(--font-sans)`, color: active ? 'var(--ink)' : 'var(--ink-2)' }}>{s.label}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--ink-4)', marginTop: 1 }}>{s.hint}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && <div style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 8 }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px', borderTop: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)' }}>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <div style={{ font: '500 12px var(--font-mono)', color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filename}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 1 }}>{estimateSize(format, selectedChapters)}</div>
          </div>
          <span style={{ flex: 1 }} />
          <Link to={`/books/${bookId}`} className="btn btn--ghost" style={{ textDecoration: 'none' }}>Отмена</Link>
          <button
            onClick={onDownload}
            disabled={busy || selectedChapters.length === 0}
            className="btn btn--primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {!busy && <Icon name="download" size={14} />}
            {downloadLabel}
          </button>
        </div>
      </div>

      {langOpen && <div onClick={() => setLangOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />}
      {langOpen && (
        <div style={{ position: 'fixed', top: langPos.top, left: langPos.left, width: langPos.width, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 9999, boxShadow: '0 8px 24px oklch(0 0 0 / 0.5)', overflow: 'hidden' }}>
          {LANGUAGES.map(l => (
            <button
              key={l.value}
              type="button"
              onClick={() => { setLanguage(l.value); setLangOpen(false); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 13.5, background: language === l.value ? 'var(--surface-2, oklch(0.22 0.01 50))' : 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', fontFamily: 'inherit' }}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function pluralNotes(n: number): string {
  const m = n % 10, h = n % 100;
  if (h >= 11 && h <= 19) return 'заметок';
  if (m === 1) return 'заметка';
  if (m >= 2 && m <= 4) return 'заметки';
  return 'заметок';
}

function pluralChapters(n: number): string {
  const m = n % 10, h = n % 100;
  if (h >= 11 && h <= 19) return 'глав';
  if (m === 1) return 'глава';
  if (m >= 2 && m <= 4) return 'главы';
  return 'глав';
}

function ToggleRow({ label, hint, on, onChange, disabled, last }: {
  label: string; hint?: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean; last?: boolean;
}) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
      borderBottom: last ? 'none' : '1px solid var(--border-soft)',
      fontSize: 13, color: disabled ? 'var(--ink-4)' : 'var(--ink-2)', cursor: disabled ? 'default' : 'pointer',
    }}>
      <input type="checkbox" checked={on} onChange={(e) => !disabled && onChange(e.target.checked)} disabled={disabled} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
      <span style={{ width: 32, height: 18, borderRadius: 999, background: on && !disabled ? 'var(--accent)' : 'var(--surface-2)', position: 'relative', transition: 'background 150ms', flexShrink: 0, opacity: disabled ? 0.4 : 1 }}>
        <span style={{ position: 'absolute', top: 2, left: on && !disabled ? 16 : 2, width: 14, height: 14, borderRadius: 999, background: on && !disabled ? 'oklch(0.98 0 0)' : 'var(--ink-2)', transition: 'left 150ms' }} />
      </span>
      <span>{label}{hint && <span style={{ color: 'var(--ink-4)', marginLeft: 4 }}>{hint}</span>}</span>
    </label>
  );
}
