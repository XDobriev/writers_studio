import DOMPurify from 'dompurify';
import { type Book } from './supabase';
import { type Chapter } from './chapters';
import { type Note } from './notes';
import {
  type Appendix,
  escapeHtml,
  addNoIndentToFirst,
  appendixHtml,
  chapterNotes,
  bookNotes,
  notesBlockHtml,
  BOOK_NOTES_TITLE,
} from './export';

export type PdfPageSize = 'a5' | 'a4';

export interface PdfBuildOpts {
  pageSize: PdfPageSize;
  includeChapterTitles: boolean;
  includeTitlePage: boolean;
  authorName: string;
  /** BCP-47 язык документа: от него зависят переносы (`hyphens`). */
  language: string;
  includeNotes: boolean;
  notes: Note[];
  appendices: Appendix[];
}

function getPrintCss(pageSize: PdfPageSize): string {
  const isA5 = pageSize === 'a5';
  return `
    @page {
      size: ${isA5 ? 'A5' : 'A4'};
      margin: ${isA5 ? '20mm 15mm 22mm 20mm' : '25mm 30mm 25mm 25mm'};
    }
    @page { @bottom-center { content: "— " counter(page) " —"; font-family: Georgia, serif; font-size: 8pt; color: #aaa; } }
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: ${isA5 ? '10.5pt' : '12pt'};
      line-height: ${isA5 ? '1.85' : '2'};
      color: ${isA5 ? '#2a2118' : '#1a1a1a'};
      background: ${isA5 ? '#faf8f4' : '#fff'};
      margin: 0; padding: 0;
    }
    p {
      ${isA5 ? 'text-indent: 1.5em; margin: 0;' : 'margin: 0 0 1em; text-indent: 0;'}
    }
    p.no-indent { text-indent: 0; }
    .title-page {
      text-align: center;
      padding-top: 35%;
      break-after: page;
    }
    h1.book-title {
      font-size: ${isA5 ? '18pt' : '22pt'};
      letter-spacing: -0.01em;
      margin: 0 0 0.4em;
    }
    .book-author {
      font-size: ${isA5 ? '11pt' : '13pt'};
      color: ${isA5 ? '#6a5f4e' : '#555'};
      margin: 0;
    }
    h2.chapter-title {
      font-size: ${isA5 ? '13pt' : '14pt'};
      text-align: center;
      margin: 2em 0 1.5em;
      break-before: page;
    }
    .chapter-first h2.chapter-title { break-before: avoid; }
    blockquote {
      margin: 1em 2em;
      font-style: italic;
    }
    .chapter-notes { margin: 2em 0 0; padding: 0.8em 1em; border: 1px solid #ddd2c0; border-radius: 4px; font-size: 0.9em; }
    .chapter-notes-title { margin: 0 0 0.5em; font-weight: bold; text-indent: 0; }
    .note-item { text-indent: 0; margin: 0 0 0.3em; }
    .appendix-entry { margin: 0 0 1.2em; break-inside: avoid; }
    .appendix-entry h3 { margin: 0 0 0.2em; font-size: 1em; }
    .appendix-meta { font-style: italic; text-indent: 0; }
    .book-notes { break-before: page; }
    strong, b { font-weight: bold; }
    em, i { font-style: italic; }
  `;
}

function buildPrintHtml(book: Book, chapters: Chapter[], opts: PdfBuildOpts): string {
  const css = getPrintCss(opts.pageSize);

  const titlePage = opts.includeTitlePage
    ? `<div class="title-page">
        <h1 class="book-title">${escapeHtml(book.title)}</h1>
        ${opts.authorName ? `<p class="book-author">${escapeHtml(opts.authorName)}</p>` : ''}
      </div>`
    : '';

  const body = chapters.map((ch, i) => {
    const isFirst = i === 0;
    const titleHtml = opts.includeChapterTitles
      ? `<h2 class="chapter-title">${escapeHtml(ch.title)}</h2>`
      : (!isFirst ? '<div style="break-before:page"></div>' : '');
    const sanitized = DOMPurify.sanitize(ch.content || '', { FORBID_TAGS: ['input', 'label'] });
    const content = opts.pageSize === 'a5'
      ? addNoIndentToFirst(sanitized)
      : sanitized;
    const notesHtml = opts.includeNotes ? notesBlockHtml(chapterNotes(opts.notes, ch.id)) : '';
    return `<div class="${isFirst ? 'chapter-first' : 'chapter'}">${titleHtml}${content}${notesHtml}</div>`;
  }).join('\n');
  const appendices = opts.appendices.map((a) => appendixHtml(a)).join('\n');
  const bn = opts.includeNotes ? bookNotes(opts.notes) : [];
  const bookNotesHtml = bn.length ? `<div class="book-notes">${notesBlockHtml(bn, BOOK_NOTES_TITLE)}</div>` : '';

  return `<!DOCTYPE html>
<html lang="${escapeHtml(opts.language)}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(book.title)}</title>
<style>${css}</style>
</head>
<body>
${titlePage}
${body}
${appendices}
${bookNotesHtml}
<script>window.addEventListener('load', function() { window.print(); });<\/script>
</body>
</html>`;
}

// Принимает уже открытое окно — window.open() вызывается в Export.tsx синхронно до async-работы,
// чтобы не потерять user gesture для popup-разрешения браузера.
export function openPrintPdf(win: Window, book: Book, chapters: Chapter[], opts: PdfBuildOpts): void {
  const html = buildPrintHtml(book, chapters, opts);
  win.document.write(html);
  win.document.close();
}
