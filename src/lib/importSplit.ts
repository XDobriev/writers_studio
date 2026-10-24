import { countWords } from './chapters';
import { finalizeChapterHtml } from './importSanitize';

// Разбивка импортированной рукописи на главы. Три способа:
//  - headings: по заголовкам (h1/h2 в DOCX/MD/EPUB, секции FB2) и границам файлов EPUB;
//  - pattern: по строкам «Глава 1», «Глава первая», «ГЛАВА IV», «Часть», «Пролог», «Эпилог»;
//  - single: одной главой.

/** Кусок исходника. У EPUB — файл из spine, у FB2 — секция верхнего уровня, у остальных — весь файл. */
export interface ImportUnit {
  html: string;
  /** Подсказка названия (пункт оглавления EPUB). */
  title?: string;
}

export interface ImportedChapter {
  title: string;
  html: string;
  words: number;
}

export type SplitMode = 'headings' | 'pattern' | 'single';

const MAX_TITLE = 200;

const ORDINAL_STEMS = [
  'перв', 'втор', 'трет', 'четв[её]рт', 'пят', 'шест', 'седьм', 'восьм', 'девят', 'десят',
  'одиннадцат', 'двенадцат', 'тринадцат', 'четырнадцат', 'пятнадцат', 'шестнадцат',
  'семнадцат', 'восемнадцат', 'девятнадцат', 'двадцат', 'тридцат', 'сороков', 'пятидесят',
  'шестидесят', 'семидесят', 'восьмидесят', 'девяност', 'сот',
].join('|');
const TENS = 'двадцать|тридцать|сорок|пятьдесят|шестьдесят|семьдесят|восемьдесят|девяносто|сто';
const CARDINALS = 'один|одна|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|одиннадцать|двенадцать';
const NUM_WORD = `(?:(?:${TENS})\\s+)?(?:(?:${ORDINAL_STEMS})(?:ая|ой|ий|ый|ье|ое|ья|ей)|${CARDINALS})|(?:${TENS})`;
const ENG_NUM = 'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve';
const BOUNDARY = '(?=$|[\\s.,:;!?)\\]»"—–-])';

const CHAPTER_RE = new RegExp(
  `^[\\s«"]*(?:(?:глава|часть|книга|том|chapter|part|book)\\s*(?:№\\s*)?(?:\\d{1,4}|[ivxlcdm]{1,8}|${NUM_WORD}|${ENG_NUM})${BOUNDARY}`
  + `|(?:пролог|эпилог|интерлюдия|послесловие|предисловие|prologue|epilogue|interlude)${BOUNDARY})`,
  'iu',
);

/** Строка — заголовок главы («Глава 1. Встреча», «ГЛАВА ПЕРВАЯ», «Пролог»), а не фраза из текста. */
export function isChapterLine(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t || t.length > 120) return false;
  const m = t.match(CHAPTER_RE);
  if (!m) return false;
  // «Глава 1 называлась странно, и он перевернул страницу» — уже предложение, не заголовок.
  const rest = t.slice(m[0].length).trim();
  return rest.split(/\s+/).filter(Boolean).length <= 12;
}

function cleanTitle(s: string): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE);
}

function normalizeForCompare(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function unitElements(html: string): HTMLElement[] {
  const doc = document.implementation.createHTMLDocument('');
  doc.body.innerHTML = html;
  return Array.from(doc.body.children) as HTMLElement[];
}

function headingLevel(el: HTMLElement): number {
  const m = el.tagName.match(/^H([1-6])$/);
  return m ? Number(m[1]) : 0;
}

/** На каких уровнях заголовков резать. Пусто — заголовков для разбивки нет. */
function chooseSplitLevels(units: ImportUnit[]): number[] {
  const counts = [0, 0, 0, 0];
  const h2Texts: string[] = [];
  for (const u of units) {
    for (const el of unitElements(u.html)) {
      const l = headingLevel(el);
      if (l >= 1 && l <= 3) counts[l]++;
      if (l === 2) h2Texts.push(el.textContent ?? '');
    }
  }
  const [, c1, c2, c3] = counts;
  const h2Chapters = h2Texts.filter(isChapterLine).length;
  // «Часть» — h1, «Глава» — h2: режем по обоим (пустая часть станет подзаголовком первой главы).
  if (c1 >= 2 && c2 >= 2 && h2Chapters >= c2 / 2) return [1, 2];
  if (c1 >= 2) return [1];
  if (c2 >= 1) return [1, 2];
  if (c3 >= 2) return [1, 2, 3];
  if (c1 === 1) return [1];
  return [];
}

interface Chunk {
  title?: string;
  /** Название взято из заголовка в тексте (а не из подсказки/номера). */
  fromHeading: boolean;
  nodes: HTMLElement[];
}

function hasText(nodes: HTMLElement[]): boolean {
  return nodes.some((n) => (n.textContent ?? '').trim());
}

function chunkElements(
  els: HTMLElement[],
  isBoundary: (el: HTMLElement) => boolean,
  startTitle?: string,
): Chunk[] {
  const chunks: Chunk[] = [];
  let cur: Chunk = { title: startTitle, fromHeading: false, nodes: [] };
  for (const el of els) {
    if (isBoundary(el)) {
      chunks.push(cur);
      cur = { title: cleanTitle(el.textContent ?? ''), fromHeading: true, nodes: [] };
    } else {
      cur.nodes.push(el);
    }
  }
  chunks.push(cur);
  return chunks;
}

/**
 * Пустой кусок (только заголовок «Часть первая» перед «Главой 1») не становится пустой
 * главой: его заголовок переезжает подзаголовком в начало следующей главы.
 * Кусок до первой границы без названия, совпадающий с названием книги, — титульный лист, выбрасываем.
 */
function mergeChunks(chunks: Chunk[], bookTitle: string): Chunk[] {
  const out: Chunk[] = [];
  let carry: string[] = [];
  const doc = document.implementation.createHTMLDocument('');
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const isLast = i === chunks.length - 1;
    if (!hasText(c.nodes)) {
      if (c.fromHeading && c.title) {
        if (isLast) {
          // Последний заголовок без текста — всё равно текст автора, не теряем.
          out.push({ ...c, nodes: carryNodes(doc, carry) });
          carry = [];
        } else carry.push(c.title);
      }
      continue;
    }
    if (!c.title && !c.fromHeading && out.length === 0 && carry.length === 0) {
      const text = c.nodes.map((n) => n.textContent ?? '').join(' ');
      if (normalizeForCompare(text) === normalizeForCompare(bookTitle)) continue;
    }
    out.push({ ...c, nodes: [...carryNodes(doc, carry), ...c.nodes] });
    carry = [];
  }
  return out;
}

function carryNodes(doc: Document, titles: string[]): HTMLElement[] {
  return titles.map((t) => {
    const h = doc.createElement('h2');
    h.textContent = t;
    return h;
  });
}

function toChapters(chunks: Chunk[]): ImportedChapter[] {
  const anyTitled = chunks.some((c) => c.title);
  return chunks.map((c, i) => {
    const html = finalizeChapterHtml(c.nodes.map((n) => n.outerHTML).join(''));
    return {
      title: c.title || (anyTitled && chunks.length > 1 ? 'Без названия' : `Глава ${i + 1}`),
      html,
      words: countWords(html),
    };
  });
}

export function splitManuscript(units: ImportUnit[], mode: SplitMode, bookTitle: string): ImportedChapter[] {
  if (mode === 'single') {
    const html = units.map((u) => u.html).join('');
    const chunks = mergeChunks([{ fromHeading: false, nodes: unitElements(html) }], bookTitle);
    const chapters = toChapters(chunks);
    return chapters.length ? [{ ...chapters[0], title: 'Глава 1' }] : [];
  }
  if (mode === 'pattern') {
    const els = unitElements(units.map((u) => u.html).join(''));
    const isBoundary = (el: HTMLElement) =>
      (el.tagName === 'P' || headingLevel(el) > 0) && isChapterLine(el.textContent ?? '');
    return toChapters(mergeChunks(chunkElements(els, isBoundary), bookTitle));
  }
  const levels = new Set(chooseSplitLevels(units));
  const isBoundary = (el: HTMLElement) => levels.has(headingLevel(el));
  const chunks: Chunk[] = [];
  for (const u of units) chunks.push(...chunkElements(unitElements(u.html), isBoundary, u.title ? cleanTitle(u.title) : undefined));
  // Файл EPUB/секция без заголовка, но начинается строкой «Глава 7» — это и есть название.
  for (const c of chunks) {
    if (c.fromHeading) continue;
    const first = c.nodes.find((n) => (n.textContent ?? '').trim());
    if (first && (first.tagName === 'P' || headingLevel(first) > 0) && isChapterLine(first.textContent ?? '')) {
      c.title = cleanTitle(first.textContent ?? '');
      c.fromHeading = true;
      c.nodes = c.nodes.filter((n) => n !== first);
    }
  }
  return toChapters(mergeChunks(chunks, bookTitle));
}

export interface SplitOption {
  mode: SplitMode;
  count: number;
}

/** Сколько глав даёт каждый способ; по умолчанию — первый, давший больше одной главы. */
export function analyzeSplits(units: ImportUnit[], bookTitle: string): { options: SplitOption[]; defaultMode: SplitMode } {
  const options: SplitOption[] = (['headings', 'pattern', 'single'] as const).map((mode) => ({
    mode,
    count: splitManuscript(units, mode, bookTitle).length,
  }));
  const best = options.find((o) => o.mode !== 'single' && o.count > 1);
  return { options, defaultMode: best?.mode ?? 'single' };
}

export interface JoinedChapter extends ImportedChapter {
  /** Индексы исходных глав, склеенных в эту: first..last. */
  first: number;
  last: number;
}

/**
 * Ручная склейка в предпросмотре: joins — индексы глав, приклеенных к предыдущей.
 * Название приклеенной главы остаётся подзаголовком, чтобы не потерять текст автора.
 */
export function joinChapters(chapters: ImportedChapter[], joins: ReadonlySet<number>): JoinedChapter[] {
  const out: JoinedChapter[] = [];
  const doc = document.implementation.createHTMLDocument('');
  chapters.forEach((c, i) => {
    const prev = out[out.length - 1];
    if (!prev || !joins.has(i)) {
      out.push({ ...c, first: i, last: i });
      return;
    }
    const h = doc.createElement('h2');
    h.textContent = c.title;
    prev.html += h.outerHTML + c.html;
    // Сумма, а не пересчёт: иначе итог «N слов» растёт от склейки на слова подзаголовков.
    prev.words += c.words;
    prev.last = i;
  });
  return out;
}
