import JSZip from 'jszip';
import DOMPurify from 'dompurify';
import type { Book } from './supabase';
import type { Chapter } from './chapters';
import {
  type BuildOpts,
  type ParagraphStyle,
  escapeHtml,
  escapeXml,
  addNoIndentToFirst,
  chapterNotes,
  bookNotes,
  notesBlockHtml,
  appendixHtml,
  BOOK_NOTES_TITLE,
} from './export';
import { serializeXhtml } from './exportModel';
import { todayLocalISODate } from './dates';

/**
 * HTML главы -> XHTML: читалки (Apple Books, Kobo, epubcheck) разбирают главу XML-парсером,
 * и `&nbsp;`, `<br>`, `<hr>` без закрытия делают её невалидной. Чекбоксы списка задач
 * в книге не нужны. Заголовки в тексте опускаем ниже заголовка главы (h2).
 */
export function chapterHtmlToXhtml(html: string, demoteHeadings: boolean): string {
  const frag = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['input', 'label', 'button', 'form'],
    RETURN_DOM_FRAGMENT: true,
  });
  if (demoteHeadings) {
    for (const h of Array.from(frag.querySelectorAll('h1, h2'))) {
      const h3 = h.ownerDocument.createElement('h3');
      for (const a of Array.from(h.attributes)) h3.setAttribute(a.name, a.value);
      while (h.firstChild) h3.appendChild(h.firstChild);
      h.replaceWith(h3);
    }
  }
  return serializeXhtml(Array.from(frag.childNodes));
}

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
.appendix-entry{margin:0 0 1.2em}
.appendix-entry h3{margin:0 0 0.2em;font-size:1.05em}
.appendix-meta{margin:0 0 0.3em;font-style:italic;color:#666;text-indent:0}
strong{font-weight:bold}em{font-style:italic}
.chapter-notes{margin:2em 0 0;padding:0.8em 1em;background:#f5f0e8;border-left:3px solid #c8b89a}
.chapter-notes-title{margin:0 0 0.5em;font-size:0.75em;color:#8a7d70;text-transform:uppercase;letter-spacing:0.08em;font-weight:600}
.note-item{margin:0 0 0.35em;font-size:0.88em;color:#4a443f;text-indent:0}
`;
}

function chapterXhtml(title: string, html: string, lang: string, includeTitle: boolean, notesHtml = ''): string {
  const heading = includeTitle ? `<h2>${escapeHtml(title)}</h2>\n  ` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${lang}" xml:lang="${lang}">
<head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head>
<body><section>${heading}${html || '<p>\u00a0</p>'}${notesHtml}</section></body>
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

function simpleXhtml(title: string, lang: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${lang}" xml:lang="${lang}">
<head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head>
<body>${body}</body>
</html>`;
}

export function buildEpubBlob(book: Book, chapters: Chapter[], opts: BuildOpts): Promise<Blob> {
  // DEFLATE для всего архива; mimetype остаётся STORE (опция на уровне файла приоритетнее).
  return buildEpubZip(book, chapters, opts).generateAsync({ type: 'blob', mimeType: 'application/epub+zip', compression: 'DEFLATE' });
}

export function buildEpubZip(book: Book, chapters: Chapter[], opts: BuildOpts): JSZip {
  // Стабильный идентификатор: повторный экспорт обновляет книгу в читалке, а не дублирует её.
  const uuid = book.id;
  const hasCover = !!opts.cover;
  const coverMime = opts.cover?.mime ?? 'image/jpeg';
  const coverExt = opts.cover?.ext ?? 'jpg';
  const today = todayLocalISODate();
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
  const apps = (opts.appendices ?? []).map((a) => ({ id: `appendix-${a.id}`, href: `appendix-${a.id}.xhtml`, a }));

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
    ...apps.map((p) => `<item id="${p.id}" href="${p.href}" media-type="application/xhtml+xml"/>`),
    ...(hasBookNotes ? [`<item id="booknotes" href="notes.xhtml" media-type="application/xhtml+xml"/>`] : []),
  ];
  const spineParts = [
    ...(hasCover ? [`<itemref idref="cover-xhtml"/>`] : []),
    ...(opts.includeTitlePage ? [`<itemref idref="title"/>`] : []),
    ...(hasMap ? [`<itemref idref="map-xhtml"/>`] : []),
    ...chs.map((c) => `<itemref idref="${c.id}"/>`),
    ...apps.map((p) => `<itemref idref="${p.id}"/>`),
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
  for (const p of apps) {
    navLi.push(`<li><a href="${p.href}">${escapeHtml(p.a.title)}</a></li>`);
    ncxPts.push(`<navPoint id="${p.id}" playOrder="${po++}"><navLabel><text>${escapeXml(p.a.title)}</text></navLabel><content src="${p.href}"/></navPoint>`);
  }
  if (hasBookNotes) {
    navLi.push(`<li><a href="notes.xhtml">${BOOK_NOTES_TITLE}</a></li>`);
    ncxPts.push(`<navPoint id="booknotes" playOrder="${po++}"><navLabel><text>${BOOK_NOTES_TITLE}</text></navLabel><content src="notes.xhtml"/></navPoint>`);
  }
  const seriesMeta = opts.series
    ? `<meta property="belongs-to-collection" id="series">${escapeXml(opts.series.name)}</meta>
  <meta refines="#series" property="collection-type">series</meta>${opts.series.number != null ? `
  <meta refines="#series" property="group-position">${opts.series.number}</meta>` : ''}`
    : '';

  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:identifier id="uid">urn:uuid:${uuid}</dc:identifier>
  <dc:title>${escapeXml(book.title)}</dc:title>
  ${book.author ? `<dc:creator>${escapeXml(book.author)}</dc:creator>` : ''}
  <dc:language>${lang}</dc:language>
  <dc:date>${today}</dc:date>
  <meta property="dcterms:modified">${today}T00:00:00Z</meta>
  ${seriesMeta}
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
<html xmlns="http://www.w3.org/1999/xhtml" lang="${lang}" xml:lang="${lang}">
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
    const nHtml = opts.includeNotes ? notesBlockHtml(chapterNotes(opts.notes, c.chapterId)) : '';
    const rawContent = opts.paragraphStyle !== 'spacing' ? addNoIndentToFirst(c.content) : c.content;
    const content = chapterHtmlToXhtml(rawContent, opts.includeChapterTitles);
    zip.file(`OEBPS/${c.href}`, chapterXhtml(c.title, content, lang, opts.includeChapterTitles, nHtml));
  }
  for (const p of apps) {
    zip.file(`OEBPS/${p.href}`, simpleXhtml(p.a.title, lang, appendixHtml(p.a)));
  }

  if (hasBookNotes) {
    const bnHtml = notesBlockHtml(bookNotes(opts.notes), BOOK_NOTES_TITLE);
    zip.file('OEBPS/notes.xhtml', simpleXhtml(BOOK_NOTES_TITLE, lang, `<section><h2>${BOOK_NOTES_TITLE}</h2>${bnHtml}</section>`));
  }

  return zip;
}
