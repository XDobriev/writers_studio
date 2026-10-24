import type { Book } from './supabase';
import type { Chapter } from './chapters';
import type { Note } from './notes';
import {
  type Appendix,
  type BuildOpts,
  escapeXml,
  escapeXmlAttr,
  arrayBufferToBase64,
  chapterNotes,
  bookNotes,
  noteLabel,
  CHAPTER_NOTES_TITLE,
  BOOK_NOTES_TITLE,
} from './export';
import { parseHtmlBlocks, splitRunsByBr, runsText, type Block, type Run } from './exportModel';
import { todayLocalISODate } from './dates';

// Жанры приложения (GenrePicker) → коды FictionBook 2.0 (FictionBookGenres.xsd).
// Берём только коды из базового списка схемы: расширенные (sf_fantasy_city и т. п.)
// строгий валидатор отклоняет.
const FB2_GENRES: Record<string, string> = {
  'фэнтези': 'sf_fantasy',
  'фэнтези (городское)': 'sf_fantasy',
  'фэнтези (тёмное)': 'sf_fantasy',
  'фэнтези (эпическое)': 'sf_epic',
  'фантастика': 'sf',
  'детектив': 'detective',
  'триллер': 'thriller',
  'хоррор': 'sf_horror',
  'мистика': 'sf_horror',
  'романтика': 'love_contemporary',
  'историческая проза': 'prose_history',
  'приключения': 'adventure',
  'постапокалипсис': 'sf',
  'антиутопия': 'sf_social',
  'лирическая проза': 'prose_contemporary',
  'нон-фикшн': 'nonfiction',
};
// `prose` нет в базовом перечне жанров FB2 2.0 — ближайший валидный общий код.
const FB2_GENRE_FALLBACK = 'prose_contemporary';

export function fb2Genres(book: Pick<Book, 'genres' | 'genre'>): string[] {
  const src = [...(book.genres ?? []), ...(book.genre ? [book.genre] : [])];
  const codes = src.map((g) => FB2_GENRES[g.trim().toLowerCase()]).filter((c): c is string => !!c);
  const unique = [...new Set(codes)];
  return unique.length ? unique : [FB2_GENRE_FALLBACK];
}

// ─── Inline ───────────────────────────────────────────────────────────────────

function runToFb2(r: Run): string {
  if (r.kind === 'br') return '';
  let t = escapeXml(r.text);
  // В FB2 2.0 нет подчёркивания — ближайшее по смыслу выделение.
  if (r.marks.includes('code')) t = `<code>${t}</code>`;
  if (r.marks.includes('sub')) t = `<sub>${t}</sub>`;
  if (r.marks.includes('sup')) t = `<sup>${t}</sup>`;
  if (r.marks.includes('s')) t = `<strikethrough>${t}</strikethrough>`;
  if (r.marks.includes('i') || r.marks.includes('u')) t = `<emphasis>${t}</emphasis>`;
  if (r.marks.includes('b')) t = `<strong>${t}</strong>`;
  if (r.href) t = `<a l:href="${escapeXmlAttr(r.href)}">${t}</a>`;
  return t;
}

function runsToFb2(runs: Run[]): string {
  return runs.map(runToFb2).join('');
}

/** Абзац с <br> (стихи, письма) → отдельная строка на каждый разрыв. Пустой — <empty-line/>. */
function paragraphToFb2(runs: Run[], prefix = ''): string[] {
  const lines = splitRunsByBr(runs);
  return lines.map((line, i) => {
    const body = (i === 0 ? escapeXml(prefix) : '') + runsToFb2(line);
    return runsText(line).trim() || (i === 0 && prefix) ? `<p>${body}</p>` : '<empty-line/>';
  });
}

// ─── Blocks ───────────────────────────────────────────────────────────────────

/** inCite: внутри <cite> нельзя вложенный <cite> — цитату в цитате разворачиваем в абзацы. */
function blocksToFb2(blocks: Block[], inCite = false, listPrefix = ''): string[] {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.kind === 'p') out.push(...paragraphToFb2(b.runs, listPrefix));
    else if (b.kind === 'heading') {
      const t = runsToFb2(b.runs.filter((r) => r.kind === 'text'));
      if (t.trim()) out.push(`<subtitle>${t}</subtitle>`);
    } else if (b.kind === 'quote') {
      const inner = blocksToFb2(b.blocks, true);
      if (!inner.length) continue;
      out.push(...(inCite ? inner : ['<cite>', ...inner, '</cite>']));
    } else if (b.kind === 'list') {
      b.items.forEach((item, i) => {
        const marker = `${listPrefix ? listPrefix.replace(/\S/g, ' ') : ''}${b.ordered ? `${b.start + i}.` : '•'} `;
        // Маркер — только у первого абзаца пункта; вложенные списки получают отступ.
        let first = true;
        for (const sub of item) {
          if (sub.kind === 'p') { out.push(...paragraphToFb2(sub.runs, first ? marker : '')); first = false; continue; }
          out.push(...blocksToFb2([sub], inCite, sub.kind === 'list' ? marker : ''));
          first = false;
        }
        if (first) out.push(`<p>${escapeXml(marker.trim())}</p>`);
      });
    } else if (b.kind === 'code') {
      for (const line of b.lines) out.push(line.trim() ? `<p><code>${escapeXml(line)}</code></p>` : '<empty-line/>');
    } else {
      out.push('<empty-line/>', '<subtitle>* * *</subtitle>', '<empty-line/>');
    }
  }
  return out;
}

function htmlToFb2Content(html: string): string {
  const lines = blocksToFb2(parseHtmlBlocks(html));
  return lines.length ? lines.join('\n') : '<empty-line/>';
}

function notesBlockFb2(notes: Note[], title = CHAPTER_NOTES_TITLE): string {
  if (!notes.length) return '';
  const items = notes.map((n) =>
    `<p><emphasis>${escapeXml(noteLabel(n))}:</emphasis> ${escapeXml(n.text)}</p>`
  ).join('\n');
  return `<cite>\n<subtitle>${escapeXml(title)}</subtitle>\n${items}\n</cite>`;
}

function appendixFb2(a: Appendix): string {
  const body = a.entries.map((e) => {
    const meta = e.meta.length ? `\n<p><emphasis>${escapeXml(e.meta.join(' · '))}</emphasis></p>` : '';
    const paras = e.paragraphs.map((p) => {
      const label = p.label ? `<strong>${escapeXml(p.label)}.</strong> ` : '';
      const text = p.italic ? `<emphasis>${escapeXml(p.text)}</emphasis>` : escapeXml(p.text);
      return `\n<p>${label}${text}</p>`;
    }).join('');
    return `<subtitle>${escapeXml(e.title)}</subtitle>${meta}${paras}`;
  }).join('\n<empty-line/>\n');
  return `<section>\n<title><p>${escapeXml(a.title)}</p></title>\n${body}\n</section>`;
}

function authorToFb2(author: string | null | undefined): string {
  const parts = (author ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `<first-name>${escapeXml(parts[0])}</first-name>\n      <last-name>${escapeXml(parts.slice(1).join(' '))}</last-name>`;
  }
  if (parts.length === 1) return `<nickname>${escapeXml(parts[0])}</nickname>`;
  return `<nickname>Автор</nickname>`;
}

/**
 * FB2 по схеме FictionBook 2.0. Порядок title-info по XSD:
 * genre+, author+, book-title, annotation?, keywords?, date?, coverpage?, lang, src-lang?, translator*, sequence*.
 * document-info: author+, program-used?, date, …, id, version.
 */
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
    // Примечания — <cite> в конце главы: секция не может смешивать абзацы и вложенные <section>.
    const notesBlock = opts.includeNotes ? notesBlockFb2(chapterNotes(opts.notes, ch.id)) : '';
    return `<section>\n${title}${htmlToFb2Content(ch.content ?? '')}${notesBlock ? '\n' + notesBlock : ''}\n</section>`;
  }).join('\n');
  const appendices = (opts.appendices ?? []).map((a) => '\n' + appendixFb2(a)).join('');
  const bn = opts.includeNotes ? bookNotes(opts.notes) : [];
  const bookNotesBlock = bn.length
    ? `\n<section>\n<title><p>${BOOK_NOTES_TITLE}</p></title>\n${notesBlockFb2(bn, BOOK_NOTES_TITLE)}\n</section>`
    : '';
  // Обложка — только JPEG/PNG (Export.tsx перекодирует WebP); иначе не ссылаемся на неё.
  const cover = opts.cover && (opts.cover.mime === 'image/jpeg' || opts.cover.mime === 'image/png') ? opts.cover : undefined;
  const author = authorToFb2(book.author);
  const sequence = opts.series
    ? `\n    <sequence name="${escapeXmlAttr(opts.series.name)}"${opts.series.number != null ? ` number="${opts.series.number}"` : ''}/>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"
             xmlns:l="http://www.w3.org/1999/xlink">
<description>
  <title-info>
${fb2Genres(book).map((g) => `    <genre>${g}</genre>`).join('\n')}
    <author>
      ${author}
    </author>
    <book-title>${escapeXml(book.title)}</book-title>
    <date value="${today}">${today}</date>${cover ? `
    <coverpage><image l:href="#cover-img"/></coverpage>` : ''}
    <lang>${escapeXml(opts.language.split('-')[0])}</lang>${sequence}
  </title-info>
  <document-info>
    <author>
      ${author}
    </author>
    <program-used>Авторская студия</program-used>
    <date value="${today}">${today}</date>
    <id>${escapeXml(book.id)}</id>
    <version>1.0</version>
  </document-info>
</description>
<body>
${opts.includeTitlePage ? `<title><p>${escapeXml(book.title)}</p>${book.author ? `<p>${escapeXml(book.author)}</p>` : ''}</title>\n` : ''}${mapSection}${sections}${appendices}${bookNotesBlock}
</body>
${cover ? `<binary id="cover-img" content-type="${cover.mime}">
${arrayBufferToBase64(cover.data)}
</binary>` : ''}${mapBinary}
</FictionBook>`;
}
