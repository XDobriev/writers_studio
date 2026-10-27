import DOMPurify from 'dompurify';
import { IMPORT_IMAGE_ATTR } from './importImages';

// Очистка импортированного HTML до подмножества, которое понимает наш TipTap
// (StarterKit + Underline/Sub/Sup/Link): абзацы, заголовки, цитаты, списки,
// разделитель, перенос строки, жирный/курсив/подчёркнутый/зачёркнутый, sub/sup, ссылки.
// Стили, классы, шрифты Word, таблицы — выбрасываются, текст остаётся. Картинки остаются только
// с меткой `data-import-id` (их кладут парсеры, байты хранятся отдельно) — одним блоком, вне абзаца.

const INLINE_TAGS = ['strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'sub', 'sup', 'a', 'br', 'span', 'code', 'small', 'big', 'font', 'mark', 'cite', 'q', 'abbr'];
const BLOCK_TAGS = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'ul', 'ol', 'li', 'hr', 'pre'];
const CONTAINER_TAGS = ['div', 'section', 'article', 'header', 'footer', 'main', 'aside', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'dl', 'dt', 'dd', 'center', 'body'];

const BLOCKISH = new Set([...BLOCK_TAGS, ...CONTAINER_TAGS]);
const RENAME: Record<string, string> = { b: 'strong', i: 'em', strike: 's', del: 's', cite: 'em' };
const KEEP_INLINE = new Set(['strong', 'em', 'u', 's', 'sub', 'sup', 'a', 'br']);

/** Строка-разделитель сцен: «***», «* * *», «---», «###», «⁂», «•••», «~~~». */
const SCENE_BREAK_RE = /^\s*(?:[*✱✳⁂•·~#=_—–-]\s*){1,7}\s*$/;

function tagOf(n: Node): string {
  return n.nodeType === Node.ELEMENT_NODE ? (n as Element).tagName.toLowerCase() : '';
}

function hasBlockChild(el: Element): boolean {
  return Array.from(el.childNodes).some((c) => BLOCKISH.has(tagOf(c)));
}

/** Инлайн-содержимое: переименование b/i/del, разворачивание span/font/code и ссылок не на http(s). */
function cleanInline(doc: Document, nodes: Iterable<Node>, into: Node) {
  for (const n of Array.from(nodes)) {
    if (n.nodeType === Node.TEXT_NODE) { into.appendChild(doc.createTextNode(n.textContent ?? '')); continue; }
    if (n.nodeType !== Node.ELEMENT_NODE) continue;
    const el = n as Element;
    let tag = tagOf(el);
    tag = RENAME[tag] ?? tag;
    if (tag === 'a') {
      const href = el.getAttribute('href') ?? '';
      if (!/^(https?:|mailto:)/i.test(href)) { cleanInline(doc, el.childNodes, into); continue; }
      const a = doc.createElement('a');
      a.setAttribute('href', href);
      cleanInline(doc, el.childNodes, a);
      if (a.textContent) into.appendChild(a);
      continue;
    }
    if (!KEEP_INLINE.has(tag)) { cleanInline(doc, el.childNodes, into); continue; }
    const out = doc.createElement(tag);
    cleanInline(doc, el.childNodes, out);
    if (tag === 'br' || out.textContent) into.appendChild(out);
  }
}

function imageBlock(doc: Document, el: Element): HTMLElement | null {
  const id = el.getAttribute(IMPORT_IMAGE_ATTR);
  if (!id) return null;
  const img = doc.createElement('img');
  img.setAttribute(IMPORT_IMAGE_ATTR, id);
  return img;
}

function imageBlocks(doc: Document, el: Element): HTMLElement[] {
  return Array.from(el.querySelectorAll('img'))
    .map((i) => imageBlock(doc, i))
    .filter((b): b is HTMLElement => !!b);
}

function makeParagraph(doc: Document, inline: Node[]): HTMLElement {
  const p = doc.createElement('p');
  cleanInline(doc, inline, p);
  // Отступы пробелами/табами в начале и «мягкий перенос» в конце абзаца Word.
  const first = p.firstChild;
  if (first?.nodeType === Node.TEXT_NODE) first.textContent = (first.textContent ?? '').replace(/^[\s]+/, '');
  while (p.lastChild && (tagOf(p.lastChild) === 'br'
    || (p.lastChild.nodeType === Node.TEXT_NODE && !(p.lastChild.textContent ?? '').trim()))) {
    p.removeChild(p.lastChild);
  }
  const last = p.lastChild;
  if (last?.nodeType === Node.TEXT_NODE) last.textContent = (last.textContent ?? '').replace(/\s+$/, '');
  return p;
}

/** Плоская последовательность блоков верхнего уровня (контейнеры разворачиваются). */
function flatten(doc: Document, parent: Node, out: HTMLElement[], inList = false) {
  let inline: Node[] = [];
  const flush = () => {
    if (!inline.length) return;
    const hasText = inline.some((n) => (n.textContent ?? '').trim() || tagOf(n) === 'br');
    // Пробелы и переводы строк между блоками (красиво отформатированный XHTML) — не абзацы.
    if (hasText) out.push(makeParagraph(doc, inline));
    inline = [];
  };
  for (const n of Array.from(parent.childNodes)) {
    const tag = tagOf(n);
    if (tag === 'img') {
      flush();
      const b = imageBlock(doc, n as Element);
      if (b) out.push(b);
      continue;
    }
    if (!BLOCKISH.has(tag)) { inline.push(n); continue; }
    flush();
    const el = n as Element;
    if (tag === 'p' || /^h[1-6]$/.test(tag)) {
      if (hasBlockChild(el)) { flatten(doc, el, out, inList); continue; }
      const imgs = imageBlocks(doc, el);
      const p = makeParagraph(doc, Array.from(el.childNodes));
      const hasText = !!p.textContent?.trim();
      if (tag !== 'p') {
        const h = doc.createElement(tag);
        while (p.firstChild) h.appendChild(p.firstChild);
        if (h.textContent?.trim()) out.push(h);
      } else if (hasText || !imgs.length) {
        out.push(p);
      }
      out.push(...imgs);
      continue;
    } else if (tag === 'hr') {
      out.push(doc.createElement('hr'));
    } else if (tag === 'pre') {
      const p = doc.createElement('p');
      (el.textContent ?? '').replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n').forEach((line, i) => {
        if (i) p.appendChild(doc.createElement('br'));
        p.appendChild(doc.createTextNode(line));
      });
      out.push(p);
    } else if (tag === 'blockquote') {
      const q = doc.createElement('blockquote');
      const inner: HTMLElement[] = [];
      flatten(doc, el, inner, true);
      for (const b of inner) q.appendChild(b.tagName.toLowerCase().match(/^h[1-6]$/) ? toP(doc, b) : b);
      if (q.textContent?.trim()) out.push(q);
    } else if (tag === 'ul' || tag === 'ol') {
      const list = doc.createElement(tag);
      const start = el.getAttribute('start');
      if (tag === 'ol' && start && /^\d+$/.test(start) && start !== '1') list.setAttribute('start', start);
      for (const c of Array.from(el.childNodes)) {
        if (tagOf(c) === 'li') {
          const li = doc.createElement('li');
          const inner: HTMLElement[] = [];
          flatten(doc, c, inner, true);
          for (const b of inner) li.appendChild(b.tagName.toLowerCase().match(/^h[1-6]$/) ? toP(doc, b) : b);
          if (li.textContent?.trim()) list.appendChild(li);
        } else if (tagOf(c) === 'ul' || tagOf(c) === 'ol') {
          // Вложенный список прямо в <ul> (так пишет часть конвертеров) — в предыдущий пункт.
          const nested: HTMLElement[] = [];
          const wrap = doc.createElement('div');
          wrap.appendChild(c.cloneNode(true));
          flatten(doc, wrap, nested, true);
          const prev = list.lastElementChild;
          for (const b of nested) (prev ?? list).appendChild(b);
        } else if ((c.textContent ?? '').trim()) {
          const li = doc.createElement('li');
          li.appendChild(makeParagraph(doc, [c]));
          list.appendChild(li);
        }
      }
      if (list.children.length) out.push(list);
    } else if (tag === 'li') {
      flatten(doc, el, out, inList);
    } else {
      // div/section/td…: с блочными детьми — разворачиваем, иначе это абзац.
      if (hasBlockChild(el)) flatten(doc, el, out, inList);
      else {
        const imgs = imageBlocks(doc, el);
        const p = makeParagraph(doc, Array.from(el.childNodes));
        if (p.textContent?.trim() || (!inList && !imgs.length)) out.push(p);
        out.push(...imgs);
      }
    }
  }
  flush();
}

function toP(doc: Document, el: HTMLElement): HTMLElement {
  const p = doc.createElement('p');
  const strong = doc.createElement('strong');
  while (el.firstChild) strong.appendChild(el.firstChild);
  p.appendChild(strong);
  return p;
}

function isEmptyP(el: HTMLElement): boolean {
  return el.tagName.toLowerCase() === 'p' && !(el.textContent ?? '').trim();
}

/**
 * Пустые абзацы Word: подряд — схлопываем в один; если ими разделён почти каждый абзац
 * (их больше 30% от абзацев с текстом) — это «интервал», а не разрывы сцен, убираем одиночные.
 * В начале и в конце — убираем всегда.
 */
function collapseEmpty(blocks: HTMLElement[]): HTMLElement[] {
  const collapsed: HTMLElement[] = [];
  const runs: number[] = [];
  for (const b of blocks) {
    if (isEmptyP(b)) {
      const prevEmpty = collapsed.length > 0 && isEmptyP(collapsed[collapsed.length - 1]);
      if (prevEmpty) { runs[runs.length - 1]++; continue; }
      runs.push(1);
    }
    collapsed.push(b);
  }
  const textParas = collapsed.filter((b) => !isEmptyP(b)).length;
  const singles = runs.filter((r) => r === 1).length;
  const spacingStyle = textParas > 0 && singles / textParas > 0.3;
  let runIdx = 0;
  const result: HTMLElement[] = [];
  for (const b of collapsed) {
    if (isEmptyP(b)) {
      const len = runs[runIdx++];
      if (spacingStyle && len === 1) continue;
    }
    result.push(b);
  }
  while (result.length && isEmptyP(result[0])) result.shift();
  while (result.length && isEmptyP(result[result.length - 1])) result.pop();
  return result;
}

/**
 * Первый проход: любой HTML (mammoth, EPUB, FB2, TXT/MD) → плоская последовательность
 * блоков TipTap. Заголовки h1–h6 сохраняются — по ним потом режем на главы.
 */
export function normalizeImportHtml(html: string): string {
  const frag = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...INLINE_TAGS, ...BLOCK_TAGS, ...CONTAINER_TAGS, 'img'],
    ALLOWED_ATTR: ['href', 'start', IMPORT_IMAGE_ATTR],
    KEEP_CONTENT: true,
    RETURN_DOM_FRAGMENT: true,
  });
  const doc = document.implementation.createHTMLDocument('');
  const blocks: HTMLElement[] = [];
  flatten(doc, frag, blocks);
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const t = b.textContent ?? '';
    if (b.tagName.toLowerCase() === 'p' && t.trim() && SCENE_BREAK_RE.test(t) && !b.querySelector('br')) {
      blocks[i] = doc.createElement('hr');
    }
  }
  // Пустые строки вокруг «***» — оформление разрыва, а не отдельные пустые абзацы.
  const noPadding = blocks.filter((b, i) =>
    !(isEmptyP(b) && (blocks[i - 1]?.tagName === 'HR' || blocks[i + 1]?.tagName === 'HR')));
  return collapseEmpty(noPadding).map((b) => b.outerHTML).join('');
}

/**
 * Финальная форма главы: заголовок главы — отдельное поле, поэтому h1 в тексте → h2,
 * h4–h6 → h3 (редактор поддерживает h1–h3). Разделитель в начале/конце главы не нужен.
 */
export function finalizeChapterHtml(html: string): string {
  const doc = document.implementation.createHTMLDocument('');
  doc.body.innerHTML = html;
  for (const h of Array.from(doc.body.querySelectorAll('h1, h4, h5, h6'))) {
    const level = h.tagName.toLowerCase() === 'h1' ? 'h2' : 'h3';
    const n = doc.createElement(level);
    while (h.firstChild) n.appendChild(h.firstChild);
    h.replaceWith(n);
  }
  const kids = Array.from(doc.body.children) as HTMLElement[];
  let start = 0, end = kids.length;
  while (start < end && (kids[start].tagName === 'HR' || isEmptyP(kids[start]))) start++;
  while (end > start && (kids[end - 1].tagName === 'HR' || isEmptyP(kids[end - 1]))) end--;
  return kids.slice(start, end).map((k) => k.outerHTML).join('');
}
