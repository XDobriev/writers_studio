// @vitest-environment jsdom
import { vi, describe, it, expect } from 'vitest';

vi.mock('./supabase', () => ({ supabase: {} }));

import JSZip from 'jszip';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { decodeText, markdownToHtml, txtToHtml } from './importText';
import { normalizeImportHtml } from './importSanitize';
import { analyzeSplits, isChapterLine, joinChapters, splitManuscript } from './importSplit';
import { parseManuscript } from './importManuscript';
import { parseFb2 } from './importFb2';

/** Минимальный кодировщик windows-1251 для кириллицы (TextEncoder умеет только UTF-8). */
function cp1251(s: string): ArrayBuffer {
  const bytes = Array.from(s).map((ch) => {
    const c = ch.charCodeAt(0);
    if (c < 0x80) return c;
    if (c >= 0x410 && c <= 0x44f) return c - 0x410 + 0xc0;
    if (c === 0x401) return 0xa8;
    if (c === 0x451) return 0xb8;
    if (c === 0x2014) return 0x97;
    return 0x3f;
  });
  return new Uint8Array(bytes).buffer;
}

function utf8(s: string): ArrayBuffer {
  const u = new TextEncoder().encode(s);
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
}

describe('decodeText', () => {
  it('UTF-8 и windows-1251 определяются автоматически', () => {
    expect(decodeText(utf8('Привет, мир — ёлка'))).toBe('Привет, мир — ёлка');
    expect(decodeText(cp1251('Привет, мир — ёлка'))).toBe('Привет, мир — ёлка');
  });
});

describe('isChapterLine', () => {
  it.each([
    'Глава 1', 'Глава 12. Встреча', 'ГЛАВА ПЕРВАЯ', 'Глава двадцать третья', 'Глава IV', 'Часть вторая',
    'Пролог', 'ЭПИЛОГ', 'Chapter 3', 'Глава 5: Огонь',
  ])('«%s» — заголовок', (s) => expect(isChapterLine(s)).toBe(true));
  it.each([
    'Глава семьи вошёл в комнату.', 'Главное — не сдаваться', 'Часть денег пропала',
    'Глава 1 называлась странно, и он долго смотрел на неё, прежде чем перевернуть страницу и начать читать дальше',
  ])('«%s» — не заголовок', (s) => expect(isChapterLine(s)).toBe(false));
});

describe('TXT', () => {
  const text = [
    'Моя книга', '', 'Глава 1', 'Первый абзац.', 'Второй абзац.', '', '***', '', 'После разрыва.',
    'Глава вторая. Дорога', 'Текст второй главы.', 'ЭПИЛОГ', 'Конец.',
  ].join('\r\n');

  it('строка = абзац, «***» → разделитель, разбивка по «Глава N»', async () => {
    const m = await parseManuscript(cp1251(text), 'Моя_книга.txt');
    expect(m.title).toBe('Моя книга');
    const { defaultMode } = analyzeSplits(m.units, m.title);
    expect(defaultMode).toBe('pattern');
    const ch = splitManuscript(m.units, 'pattern', m.title);
    expect(ch.map((c) => c.title)).toEqual(['Глава 1', 'Глава вторая. Дорога', 'ЭПИЛОГ']);
    expect(ch[0].html).toBe('<p>Первый абзац.</p><p>Второй абзац.</p><hr><p>После разрыва.</p>');
    expect(ch[0].words).toBe(6);
  });

  it('жёсткие переносы Gutenberg склеиваются в абзацы', () => {
    const wrapped = 'Это длинная строка, перенесённая\nпосреди предложения вручную.\n\nВторой абзац тоже\nразбит на две строки.';
    expect(txtToHtml(wrapped)).toBe('<p>Это длинная строка, перенесённая посреди предложения вручную.</p><p>Второй абзац тоже разбит на две строки.</p>');
  });

  it('нет «Глава N» — одна глава', () => {
    const units = [{ html: normalizeImportHtml(txtToHtml('Просто текст.\nЕщё строка.')) }];
    const { defaultMode, options } = analyzeSplits(units, 'Книга');
    expect(defaultMode).toBe('single');
    expect(options.find((o) => o.mode === 'single')?.count).toBe(1);
  });
});

describe('Markdown', () => {
  it('заголовки, выделение, списки, цитаты, разделитель, диалог через дефис', () => {
    const md = [
      '# Глава 1', '', 'Абзац с *курсивом*, **жирным** и ~~зачёркнутым~~,', 'продолжение строки.', '',
      '- пункт', '- второй', '  - вложенный', '', '> цитата', '', '---', '',
      '- Привет, - сказал он.', '', '## Глава 2', '', 'Текст [ссылка](https://example.com).',
    ].join('\n');
    const html = markdownToHtml(md);
    expect(html).toContain('<h1>Глава 1</h1>');
    expect(html).toContain('<p>Абзац с <em>курсивом</em>, <strong>жирным</strong> и <s>зачёркнутым</s>, продолжение строки.</p>');
    expect(html).toContain('<ul><li><p>пункт</p></li><li><p>второй</p><ul><li><p>вложенный</p></li></ul></li></ul>');
    expect(html).toContain('<blockquote><p>цитата</p></blockquote>');
    expect(html).toContain('<hr>');
    expect(html).toContain('<p>- Привет, - сказал он.</p>');
    expect(html).toContain('<a href="https://example.com">ссылка</a>');
    const units = [{ html: normalizeImportHtml(html) }];
    const ch = splitManuscript(units, 'headings', 'Книга');
    expect(ch.map((c) => c.title)).toEqual(['Глава 1', 'Глава 2']);
  });
});

describe('FB2', () => {
  const fb2 = `<?xml version="1.0" encoding="windows-1251"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:l="http://www.w3.org/1999/xlink">
<description><title-info><genre>sf</genre><author><first-name>Анна</first-name><last-name>Иванова</last-name></author>
<book-title>Звёздный путь</book-title><lang>ru</lang></title-info></description>
<body>
<section><title><p>Часть первая</p></title>
  <section><title><p>Глава 1</p><p>Начало</p></title>
    <epigraph><p>Эпиграф</p><text-author>Мудрец</text-author></epigraph>
    <p>Текст с <emphasis>курсивом</emphasis> и <strong>жирным</strong> & амперсандом.</p>
    <empty-line/>
    <subtitle>* * *</subtitle>
    <poem><stanza><v>Строка один</v><v>Строка два</v></stanza></poem>
  </section>
  <section><title><p>Глава 2</p></title><p>Вторая глава<a l:href="#n1" type="note">1</a>.</p></section>
</section>
</body>
<body name="notes"><section id="n1"><title><p>1</p></title><p>Сноска.</p></section></body>
</FictionBook>`;

  it('windows-1251, метаданные, секции → главы, части — подзаголовком, сноски не теряются', async () => {
    const r = await parseFb2(cp1251(fb2));
    expect(r.title).toBe('Звёздный путь');
    expect(r.author).toBe('Анна Иванова');
    const m = await parseManuscript(cp1251(fb2), 'book.fb2');
    const ch = splitManuscript(m.units, 'headings', m.title);
    expect(ch.map((c) => c.title)).toEqual(['Глава 1. Начало', 'Глава 2', 'Примечания']);
    expect(ch[0].html).toContain('<h2>Часть первая</h2>');
    expect(ch[0].html).toContain('<blockquote><p>Эпиграф</p><p><em>Мудрец</em></p></blockquote>');
    expect(ch[0].html).toContain('<em>курсивом</em>');
    expect(ch[0].html).toContain('&amp; амперсандом');
    expect(ch[0].html).toContain('<hr>');
    expect(ch[0].html).toContain('<p>Строка один<br>Строка два</p>');
    expect(ch[1].html).toContain('<sup>1</sup>');
    expect(ch[2].html).toContain('Сноска.');
  });
});

describe('EPUB', () => {
  async function makeEpub(): Promise<ArrayBuffer> {
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip');
    zip.file('META-INF/container.xml', `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
    zip.file('OPS/book.opf', `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Тестовый EPUB</dc:title><dc:creator>Пётр</dc:creator></metadata>
<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="t" href="text/title.xhtml" media-type="application/xhtml+xml"/><item id="c1" href="text/c1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="text/c%202.xhtml" media-type="application/xhtml+xml"/></manifest>
<spine><itemref idref="t"/><itemref idref="c1"/><itemref idref="c2"/></spine></package>`);
    zip.file('OPS/nav.xhtml', `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="text/c1.xhtml">Первая</a></li><li><a href="text/c%202.xhtml#x">Вторая из оглавления</a></li></ol></nav></body></html>`);
    zip.file('OPS/text/title.xhtml', `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Тестовый EPUB</h1><p>Пётр</p></body></html>`);
    zip.file('OPS/text/c1.xhtml', `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body>\n  <h2>Глава 1</h2>\n  <p>Текст&#160;первой <i>главы</i>.</p>\n</body></html>`);
    zip.file('OPS/text/c 2.xhtml', `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body><div class="x"><p>Без заголовка, <span style="color:red">со стилем</span>.</p></div></body></html>`);
    return zip.generateAsync({ type: 'arraybuffer' });
  }

  it('spine → главы, оглавление даёт названия, титульный лист пропущен', async () => {
    const m = await parseManuscript(await makeEpub(), 'x.epub');
    expect(m.title).toBe('Тестовый EPUB');
    expect(m.author).toBe('Пётр');
    const ch = splitManuscript(m.units, 'headings', m.title);
    expect(ch.map((c) => c.title)).toEqual(['Глава 1', 'Вторая из оглавления']);
    expect(ch[0].html).toBe('<p>Текст&nbsp;первой <em>главы</em>.</p>');
    expect(ch[1].html).toBe('<p>Без заголовка, со стилем.</p>');
  });
});

describe('DOCX (mammoth)', () => {
  it('заголовки Word → главы, форматирование сохраняется, пустые абзацы Word убираются', async () => {
    const doc = new Document({
      title: 'Роман из Word',
      creator: 'Автор Word',
      sections: [{
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Глава 1')] }),
          new Paragraph({ children: [new TextRun('Обычный '), new TextRun({ text: 'жирный', bold: true }), new TextRun({ text: ' курсив', italics: true })] }),
          new Paragraph({ children: [] }),
          new Paragraph({ children: [] }),
          new Paragraph({ children: [new TextRun('После пустых строк.')] }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Глава 2')] }),
          new Paragraph({ children: [new TextRun({ text: 'Подчёркнутый', underline: {} })] }),
        ],
      }],
    });
    const buf = await Packer.toBuffer(doc);
    // Копия в ArrayBuffer текущего realm (jsdom): JSZip проверяет instanceof.
    const ab = Uint8Array.from(buf).buffer;
    const m = await parseManuscript(ab, 'roman.docx');
    expect(m.title).toBe('Роман из Word');
    expect(m.author).toBe('Автор Word');
    const ch = splitManuscript(m.units, 'headings', m.title);
    expect(ch.map((c) => c.title)).toEqual(['Глава 1', 'Глава 2']);
    expect(ch[0].html).toBe('<p>Обычный <strong>жирный</strong><em> курсив</em></p><p></p><p>После пустых строк.</p>');
    expect(ch[1].html).toBe('<p><u>Подчёркнутый</u></p>');
  }, 60_000);
});

describe('normalizeImportHtml', () => {
  it('Word-мусор: стили, span, пустые абзацы-интервалы, отступы пробелами', () => {
    const html = '<p style="x"><span class="a">   Абзац один</span></p><p></p><p>Абзац два</p><p></p><p>Абзац три</p><p>&nbsp;</p><p>Абзац четыре</p>';
    expect(normalizeImportHtml(html)).toBe('<p>Абзац один</p><p>Абзац два</p><p>Абзац три</p><p>Абзац четыре</p>');
  });

  it('ссылки только http(s), скрипты и картинки выброшены', () => {
    const html = '<p><a href="javascript:alert(1)">плохая</a> <a href="https://ok.ru">хорошая</a><img src="x"><script>alert(1)</script></p>';
    expect(normalizeImportHtml(html)).toBe('<p>плохая <a href="https://ok.ru">хорошая</a></p>');
  });
});

describe('joinChapters', () => {
  const chapters = [
    { title: 'Глава 1', html: '<p>раз два</p>', words: 2 },
    { title: 'Глава 2 <тайна>', html: '<p>три</p>', words: 1 },
    { title: 'Глава 3', html: '<p>четыре</p>', words: 1 },
    { title: 'Глава 4', html: '<p>пять</p>', words: 1 },
  ];

  it('без склеек — те же главы с диапазоном из одной', () => {
    const out = joinChapters(chapters, new Set());
    expect(out.map((c) => [c.first, c.last])).toEqual([[0, 0], [1, 1], [2, 2], [3, 3]]);
  });

  it('приклеенная глава становится подзаголовком, название экранируется', () => {
    const out = joinChapters(chapters, new Set([1, 2]));
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ title: 'Глава 1', first: 0, last: 2 });
    expect(out[0].html).toBe('<p>раз два</p><h2>Глава 2 &lt;тайна&gt;</h2><p>три</p><h2>Глава 3</h2><p>четыре</p>');
    expect(out[0].words).toBe(4);
    expect(out[1]).toMatchObject({ title: 'Глава 4', first: 3, last: 3 });
  });

  it('склейка первой главы игнорируется, исходник не мутирует', () => {
    const out = joinChapters(chapters, new Set([0]));
    expect(out).toHaveLength(4);
    expect(chapters[0].html).toBe('<p>раз два</p>');
  });
});
