import type { Book } from './supabase';
import type { Chapter } from './chapters';
import type { Note } from './notes';
import {
  type BuildOpts,
  escapeXml,
  arrayBufferToBase64,
  chapterNotes,
  bookNotes,
  noteLabel,
} from './export';
import { todayLocalISODate } from './dates';

function notesBlockFb2(notes: Note[]): string {
  if (!notes.length) return '';
  const items = notes.map((n) =>
    `<p><emphasis>${escapeXml(noteLabel(n))}:</emphasis> ${escapeXml(n.text)}</p>`
  ).join('\n');
  return `<cite>\n<subtitle>Примечания автора</subtitle>\n${items}\n</cite>`;
}

function inlineToFb2(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeXml(node.textContent ?? '');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  const inner = Array.from(el.childNodes).map(inlineToFb2).join('');
  if (tag === 'strong' || tag === 'b') return `<strong>${inner}</strong>`;
  if (tag === 'em' || tag === 'i') return `<emphasis>${inner}</emphasis>`;
  if (tag === 's' || tag === 'del') return `<strikethrough>${inner}</strikethrough>`;
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

function authorToFb2(author: string | null | undefined): string {
  const parts = (author ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `<first-name>${escapeXml(parts[0])}</first-name>\n      <last-name>${escapeXml(parts.slice(1).join(' '))}</last-name>`;
  }
  if (parts.length === 1) return `<nickname>${escapeXml(parts[0])}</nickname>`;
  return `<nickname>Автор</nickname>`;
}

export function buildFb2Doc(book: Book, chapters: Chapter[], opts: BuildOpts): string {
  const mapSection = opts.mapImage
    ? `\n<section>\n<title><p>Карта мира</p></title>\n<image l:href="#map-img"/>\n</section>`
    : '';
  const mapBinary = opts.mapImage
    ? `\n<binary id="map-img" content-type="image/png">\n${arrayBufferToBase64(opts.mapImage)}\n</binary>`
    : '';
  const today = todayLocalISODate();
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
      ${authorToFb2(book.author)}
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
