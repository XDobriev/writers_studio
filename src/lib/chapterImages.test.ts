// @vitest-environment jsdom
import { vi, describe, it, expect } from 'vitest';

vi.mock('./supabase', () => ({ supabase: {}, ensureAuthReady: vi.fn() }));

import JSZip from 'jszip';
import { Document, Packer, Paragraph, ImageRun } from 'docx';
import { normalizeImportHtml } from './importSanitize';
import { referencedImageIds, rewriteImportImages } from './importImages';
import { parseManuscript } from './importManuscript';
import type { Book } from './supabase';
import type { Chapter } from './chapters';
import { buildHtmlDoc, buildMarkdownDoc, type BuildOpts, type ChapterImage } from './export';
import { buildFb2Doc } from './exportFb2';
import { buildEpubZip } from './exportEpub';
import { buildDocxDocument } from './exportDocx';

// PNG 1×1
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
const URL_1 = 'https://x.supabase.co/storage/v1/object/public/chapter-images/u/b/1.webp';

describe('метки картинок импорта', () => {
  it('img с меткой — отдельный блок, текст абзаца сохраняется, чужие img выбрасываются', () => {
    const html = normalizeImportHtml(
      '<p>До <img data-import-id="img1"> после</p><p><img data-import-id="img2"></p><p><img src="https://evil/x.png">Текст</p>',
    );
    expect(html).toBe('<p>До  после</p><img data-import-id="img1"><img data-import-id="img2"><p>Текст</p>');
    expect(referencedImageIds(html)).toEqual(['img1', 'img2']);
  });

  it('rewriteImportImages: URL подставляется, не загрузившаяся картинка убирается', () => {
    const html = '<p>a</p><img data-import-id="img1"><img data-import-id="img2">';
    expect(rewriteImportImages(html, new Map([['img1', URL_1]]))).toBe(`<p>a</p><img src="${URL_1}">`);
  });
});

describe('импорт: файлы с картинками', () => {
  it('DOCX: картинка уходит в images, в тексте — метка', async () => {
    const doc = new Document({ sections: [{ children: [
      new Paragraph('Перед'),
      new Paragraph({ children: [new ImageRun({ data: PNG, transformation: { width: 10, height: 10 }, type: 'png' })] }),
      new Paragraph('После'),
    ] }] });
    const buf = await Packer.toBuffer(doc);
    const r = await parseManuscript(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, 'a.docx');
    const ids = r.units.flatMap((u) => referencedImageIds(u.html));
    expect(ids).toHaveLength(1);
    expect(r.images.get(ids[0])?.mime).toBe('image/png');
    expect(r.images.get(ids[0])?.bytes.length).toBeGreaterThan(10);
  });

  it('FB2: <image> + <binary> → метка и байты', async () => {
    const b64 = btoa(String.fromCharCode(...PNG));
    const fb2 = `<?xml version="1.0" encoding="UTF-8"?><FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:l="http://www.w3.org/1999/xlink"><description><title-info><book-title>Т</book-title></title-info></description><body><section><title><p>Глава</p></title><p>Текст</p><image l:href="#pic"/><p>Ещё</p></section></body><binary id="pic" content-type="image/png">${b64}</binary></FictionBook>`;
    const r = await parseManuscript(new TextEncoder().encode(fb2).buffer as ArrayBuffer, 'a.fb2');
    expect(r.units[0].html).toContain('data-import-id="pic"');
    expect(r.images.get('pic')?.mime).toBe('image/png');
  });

  it('EPUB: <img src> относительно файла → метка и байты из архива', async () => {
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip');
    zip.file('META-INF/container.xml', '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
    zip.file('OEBPS/content.opf', '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Книга</dc:title></metadata><manifest><item id="c1" href="text/c1.xhtml" media-type="application/xhtml+xml"/><item id="i1" href="img/a.png" media-type="image/png"/></manifest><spine><itemref idref="c1"/></spine></package>');
    zip.file('OEBPS/text/c1.xhtml', '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Глава</h1><p>Текст главы</p><div><img src="../img/a.png" alt=""/></div></body></html>');
    zip.file('OEBPS/img/a.png', PNG);
    const r = await parseManuscript(await zip.generateAsync({ type: 'arraybuffer' }), 'a.epub');
    const ids = r.units.flatMap((u) => referencedImageIds(u.html));
    expect(ids).toHaveLength(1);
    expect(r.images.get(ids[0])?.bytes.length).toBe(PNG.length);
  });
});

describe('экспорт глав с картинками', () => {
  const book = { id: 'b1', title: 'Книга', author: 'А', genre: null, genres: [] } as unknown as Book;
  const chapters = [{
    id: 'c1', title: 'Глава', position: 0, words: 1,
    content: `<p>Текст</p><img src="${URL_1}"><p>Дальше</p><img src="https://x/missing.png">`,
  } as unknown as Chapter];
  const img: ChapterImage = { data: PNG.buffer.slice(0) as ArrayBuffer, mime: 'image/png', ext: 'png', width: 1, height: 1 };
  const opts: BuildOpts = {
    includeChapterTitles: true, includeTitlePage: false, language: 'ru-RU', includeNotes: false, notes: [],
    paragraphStyle: 'indent', chapterImages: new Map([[URL_1, img]]),
  };

  it('EPUB: файл в OEBPS/images, item в манифесте, src относительный; неизвестная картинка убрана', async () => {
    const zip = buildEpubZip(book, chapters, opts);
    expect(zip.file('OEBPS/images/ch-1.png')).toBeTruthy();
    expect(await zip.file('OEBPS/content.opf')!.async('string')).toContain('href="images/ch-1.png" media-type="image/png"');
    const xhtml = await zip.file('OEBPS/ch001.xhtml')!.async('string');
    expect(xhtml).toContain('<img src="images/ch-1.png" alt=""/>');
    expect(xhtml).not.toContain('missing.png');
  });

  it('FB2: <image> и <binary> на месте, без дублей', () => {
    const fb2 = buildFb2Doc(book, chapters, opts);
    expect(fb2).toContain('<image l:href="#chimg-1"/>');
    expect(fb2).toContain('<binary id="chimg-1" content-type="image/png">');
    expect(fb2.match(/<binary id="chimg-/g)).toHaveLength(1);
  });

  it('DOCX: картинка попадает в документ', async () => {
    const buf = await Packer.toBuffer(await buildDocxDocument(book, chapters, opts));
    const zip = await JSZip.loadAsync(buf);
    expect(Object.keys(zip.files).some((f) => f.startsWith('word/media/'))).toBe(true);
  });

  it('HTML: картинка встроена как data: URI; Markdown: ссылка', () => {
    const html = buildHtmlDoc(book, chapters, opts);
    expect(html).toContain('src="data:image/png;base64,');
    expect(html).not.toContain(URL_1);
    expect(buildMarkdownDoc(book, chapters, opts)).toContain(`![](${URL_1})`);
  });
});
