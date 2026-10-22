import { vi, describe, it, expect } from 'vitest';

vi.mock('./supabase', () => ({ supabase: {}, ensureAuthReady: vi.fn() }));

import JSZip from 'jszip';
import { Packer } from 'docx';
import type { Book } from './supabase';
import type { Chapter } from './chapters';
import type { Character } from './characters';
import type { Location } from './locations';
import type { Note } from './notes';
import {
  type BuildOpts,
  buildCharactersAppendix,
  buildLocationsAppendix,
  buildMarkdownDoc,
  buildTextDoc,
  sniffImageMime,
} from './export';
import { buildFb2Doc, fb2Genres } from './exportFb2';
import { buildEpubZip } from './exportEpub';
import { buildDocxDocument } from './exportDocx';

const book: Book = {
  id: '3f1d2c4b-1111-4222-8333-444455556666',
  user_id: 'u1',
  title: 'Тестовая книга & «кавычки»',
  author: 'Иван Петров',
  cover: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  daily_goal: 0,
  genre: null,
  genres: ['Фэнтези', 'Детектив', 'Своё'],
  goal: 0,
  map_bg_url: null,
  map_template: null,
  series_id: null,
  series_order: null,
  share_token: null,
  words: 0,
};

// Всё, что реально выдаёт TipTap и ломало экспорт: &nbsp;, <br>, <hr>, код-блок,
// два абзаца в пункте списка, вложенный список, task list, sub/sup, h1 в тексте.
const NASTY = [
  '<p>Первый&nbsp;абзац с <strong>жирным</strong> и <em>курсивом</em>, H<sub>2</sub>O, x<sup>2</sup>, <u>подчёркнутое</u>.</p>',
  '<p>Строка стиха один<br>Строка стиха два</p>',
  '<hr>',
  '<pre><code>письмо внутри кода\nвторая строка</code></pre>',
  '<ul><li><p>пункт один</p><p>второй абзац пункта</p><ul><li><p>вложенный пункт</p></li></ul></li><li><p>пункт два</p></li></ul>',
  '<ol start="3"><li><p>третий</p></li></ol>',
  '<ul data-type="taskList"><li data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>задача</p></div></li></ul>',
  '<h1>Заголовок в тексте</h1>',
  '<blockquote><p>цитата</p><blockquote><p>цитата в цитате</p></blockquote></blockquote>',
  '<p></p>',
  '<p>Ссылка <a href="https://example.com/?a=1&amp;b=2">сайт</a> и голый текст</p>',
].join('');

function chapter(id: string, title: string, content: string, position: number): Chapter {
  return {
    id, book_id: book.id, user_id: 'u1', title, content, position, words: 10, status: 'draft',
    synopsis: '', created_at: `2026-01-0${position + 1}T00:00:00Z`, updated_at: '2026-01-01T00:00:00Z',
  };
}

const chapters = [chapter('c1', 'Глава 1 <первая>', NASTY, 0), chapter('c2', 'Глава 2', '<p>Короткая</p>', 1)];

const note = (id: string, chapterId: string | null, text: string): Note => ({
  id, book_id: book.id, user_id: 'u1', chapter_id: chapterId, kind: 'idea', text, position: 0,
  custom_color: null, custom_label: null, created_at: '2026-01-01T00:00:00Z',
});

const characters = [{
  id: 'ch1', book_id: book.id, user_id: 'u1', name: 'Анна', role: 'protagonist', age: 23, aliases: ['Аня'],
  quote: 'Не сдавайся', appearance: 'Рыжая', personality: 'Упрямая', backstory: 'СПОЙЛЕР', interior_life: '',
  exterior_life: '', gap: '', notes: 'рабочая заметка', position: 0, avatar_url: null,
  created_at: '', updated_at: '',
}] as Character[];

const locations = [{
  id: 'l1', book_id: book.id, user_id: 'u1', name: 'Северный город', type: 'city', role: 'столица',
  description: 'Холодно', position: 0, size: 1, x: null, y: null, created_at: '', updated_at: '',
}] as Location[];

const appendices = [buildCharactersAppendix(characters)!, buildLocationsAppendix(locations)!];

const opts: BuildOpts = {
  includeChapterTitles: true,
  includeTitlePage: true,
  language: 'ru-RU',
  includeNotes: true,
  notes: [note('n1', 'c1', 'Примечание к главе'), note('n2', null, 'Общая заметка')],
  paragraphStyle: 'indent',
  appendices,
  series: { name: 'Сага', number: 2 },
};

function parseXml(s: string, type: DOMParserSupportedType = 'application/xml') {
  const doc = new DOMParser().parseFromString(s, type);
  const err = doc.getElementsByTagName('parsererror')[0];
  return { doc, error: err?.textContent ?? null };
}

describe('EPUB', () => {
  it('каждый XHTML-файл парсится как application/xhtml+xml без parsererror', async () => {
    const zip = buildEpubZip(book, chapters, opts);
    const names = Object.keys(zip.files).filter((n) => n.endsWith('.xhtml') || n.endsWith('.opf') || n.endsWith('.ncx'));
    expect(names).toContain('OEBPS/ch001.xhtml');
    expect(names).toContain('OEBPS/appendix-characters.xhtml');
    for (const name of names) {
      const text = await zip.file(name)!.async('string');
      const { error } = parseXml(text, name.endsWith('.xhtml') ? 'application/xhtml+xml' : 'application/xml');
      expect(error, `${name}: ${error}`).toBeNull();
    }
  });

  it('глава без &nbsp;-сущностей, без чекбоксов, текст кода и списков сохранён', async () => {
    const ch = await buildEpubZip(book, chapters, opts).file('OEBPS/ch001.xhtml')!.async('string');
    expect(ch).not.toContain('&nbsp;');
    expect(ch).toContain('Первый абзац');
    expect(ch).toContain('<br/>');
    expect(ch).toContain('<hr/>');
    expect(ch).not.toContain('<input');
    expect(ch).toContain('письмо внутри кода');
    expect(ch).toContain('второй абзац пункта');
    expect(ch).not.toMatch(/<h1/);
    expect(ch).toContain('Примечание к главе');
  });

  it('стабильный identifier от book.id, серия и mimetype первым без сжатия', async () => {
    const zip = buildEpubZip(book, chapters, opts);
    const opf = await zip.file('OEBPS/content.opf')!.async('string');
    expect(opf).toContain(`urn:uuid:${book.id}`);
    expect(opf).toContain('belongs-to-collection');
    expect(Object.keys(zip.files)[0]).toBe('mimetype');
    const nav = await zip.file('OEBPS/nav.xhtml')!.async('string');
    expect(nav).toContain('Действующие лица');
    expect(nav).toContain('Локации');
  });
});

describe('FB2', () => {
  const fb2 = buildFb2Doc(book, chapters, opts);

  it('well-formed XML', () => {
    expect(parseXml(fb2).error).toBeNull();
  });

  it('порядок title-info по XSD и полный document-info', () => {
    const { doc } = parseXml(fb2);
    const ti = doc.getElementsByTagName('title-info')[0];
    const order = Array.from(ti.children).map((c) => c.localName);
    const idx = (n: string) => order.indexOf(n);
    expect(order.slice(0, 2)).toEqual(['genre', 'genre']);
    expect(idx('author')).toBeGreaterThan(idx('genre'));
    expect(idx('book-title')).toBeGreaterThan(idx('author'));
    expect(idx('date')).toBeGreaterThan(idx('book-title'));
    expect(idx('lang')).toBeGreaterThan(idx('date'));
    expect(idx('sequence')).toBeGreaterThan(idx('lang'));
    const di = Array.from(doc.getElementsByTagName('document-info')[0].children).map((c) => c.localName);
    expect(di).toEqual(['author', 'program-used', 'date', 'id', 'version']);
  });

  it('жанры книги → коды fb2, неизвестный пропущен, fallback валиден', () => {
    expect(fb2Genres(book)).toEqual(['sf_fantasy', 'detective']);
    expect(fb2Genres({ genres: ['Своё'], genre: null })).toEqual(['prose_contemporary']);
  });

  it('pre/code, второй абзац в li, вложенный список, sup/sub и стихи не теряются', () => {
    expect(fb2).toContain('<code>письмо внутри кода</code>');
    expect(fb2).toContain('второй абзац пункта');
    expect(fb2).toContain('вложенный пункт');
    expect(fb2).toContain('<sub>2</sub>');
    expect(fb2).toContain('<sup>2</sup>');
    expect(fb2).toContain('<p>Строка стиха один</p>');
    expect(fb2).toContain('<p>Строка стиха два</p>');
    expect(fb2).toContain('<subtitle>* * *</subtitle>');
    expect(fb2).toContain('Действующие лица');
    expect(fb2).not.toContain('СПОЙЛЕР');
  });
});

describe('DOCX', () => {
  it('нет PageBreak-абзацев и пустых страниц; заголовки текста ниже заголовка главы', async () => {
    const docx = await buildDocxDocument(book, chapters, opts);
    const zip = await JSZip.loadAsync(await Packer.toBuffer(docx));
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).not.toContain('w:type="page"');
    // титул, оглавление, 2 главы, 2 приложения, общие заметки → 6 разрывов перед страницами
    expect(xml.match(/<w:pageBreakBefore\/>/g)?.length).toBe(6);
    expect(xml).toContain('письмо внутри кода');
    expect(xml).toContain('второй абзац пункта');
    expect(xml).toContain('вложенный пункт');
    // в тексте был <h1> — в DOCX он Heading2, глава — Heading1
    expect(xml).toMatch(/Heading2[\s\S]*Заголовок в тексте/);
    const core = await zip.file('docProps/core.xml')!.async('string');
    expect(core).toContain('Иван Петров');
  });
});

describe('TXT / Markdown', () => {
  it('код, списки и примечания попадают в текстовые форматы', () => {
    const txt = buildTextDoc(book, chapters, opts);
    expect(txt).toContain('письмо внутри кода');
    expect(txt).toContain('• пункт один');
    expect(txt).toContain('Примечание к главе');
    expect(txt).toContain('Действующие лица');
    const md = buildMarkdownDoc(book, chapters, opts);
    expect(md).toContain('```\nписьмо внутри кода\nвторая строка\n```');
    expect(md).toContain('  - вложенный пункт');
    expect(md).toContain('3. третий');
    expect(md).toContain('### Заголовок в тексте');
  });
});

describe('sniffImageMime', () => {
  it('определяет тип по сигнатуре', () => {
    expect(sniffImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer)).toBe('image/jpeg');
    expect(sniffImageMime(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]).buffer)).toBe('image/webp');
    expect(sniffImageMime(new Uint8Array([1, 2, 3]).buffer)).toBeNull();
  });
});
