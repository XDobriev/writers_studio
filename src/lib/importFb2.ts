import { escapeText } from './importText';
import type { ImportUnit } from './importSplit';

// FB2 → HTML. Каждая секция верхнего уровня основного <body> — отдельный кусок (глава),
// её <title> — <h1>, вложенные секции — <h2>/<h3>. Сноски (<body name="notes">) —
// последним куском «Примечания»: текст не теряется.

export interface Fb2Result {
  title: string | null;
  author: string | null;
  units: ImportUnit[];
}

/** Кодировка из XML-декларации; windows-1251 у старых FB2 встречается постоянно. */
function decodeXmlBytes(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return new TextDecoder('utf-8').decode(b.subarray(3));
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b.subarray(2));
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b.subarray(2));
  const head = new TextDecoder('latin1').decode(b.subarray(0, 200));
  const enc = head.match(/encoding\s*=\s*["']([\w.:-]+)["']/i)?.[1]?.toLowerCase() ?? 'utf-8';
  try {
    return new TextDecoder(enc).decode(b);
  } catch {
    return new TextDecoder('utf-8').decode(b);
  }
}

function parseXml(text: string): Document {
  const parser = new DOMParser();
  let doc = parser.parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) {
    // Частая ошибка самодельных FB2 — голый «&» в тексте.
    const fixed = text.replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
    doc = parser.parseFromString(fixed, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) {
      throw new Error('Файл FB2 повреждён: не удалось разобрать XML.');
    }
  }
  return doc;
}

function kids(el: Element, name?: string): Element[] {
  return Array.from(el.children).filter((c) => !name || c.localName === name);
}

function first(el: Element | null | undefined, name: string): Element | null {
  return el ? kids(el, name)[0] ?? null : null;
}

function text(el: Element | null): string {
  return (el?.textContent ?? '').replace(/[ \t\r\n]+/g, ' ').trim();
}

function inline(el: Element): string {
  let out = '';
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === Node.TEXT_NODE) { out += escapeText((n.textContent ?? '').replace(/[ \t\r\n]+/g, ' ')); continue; }
    if (n.nodeType !== Node.ELEMENT_NODE) continue;
    const c = n as Element;
    const inner = inline(c);
    switch (c.localName) {
      case 'strong': out += `<strong>${inner}</strong>`; break;
      case 'emphasis': out += `<em>${inner}</em>`; break;
      case 'strikethrough': out += `<s>${inner}</s>`; break;
      case 'sub': out += `<sub>${inner}</sub>`; break;
      case 'sup': out += `<sup>${inner}</sup>`; break;
      case 'a': {
        const href = c.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ?? c.getAttribute('l:href') ?? c.getAttribute('href') ?? '';
        if (/^https?:/i.test(href)) out += `<a href="${escapeText(href)}">${inner}</a>`;
        else if (c.getAttribute('type') === 'note' || href.startsWith('#')) out += `<sup>${inner}</sup>`;
        else out += inner;
        break;
      }
      default: out += inner;
    }
  }
  return out;
}

function titleText(t: Element | null): string {
  if (!t) return '';
  const parts = kids(t, 'p').map(text).filter(Boolean);
  return (parts.length ? parts : [text(t)]).join('. ').replace(/\.\s*\./g, '.');
}

function blocks(el: Element, depth: number): string {
  let out = '';
  for (const c of kids(el)) {
    switch (c.localName) {
      case 'title': break;
      case 'p': out += `<p>${inline(c)}</p>`; break;
      case 'empty-line': out += '<p></p>'; break;
      case 'subtitle': {
        const t = text(c);
        out += /^[\s*⁂•·~#=_—–-]+$/.test(t) ? '<hr>' : `<h3>${inline(c)}</h3>`;
        break;
      }
      case 'epigraph':
      case 'cite':
      case 'annotation': {
        const inner = blocks(c, depth) + kids(c, 'text-author').map((a) => `<p><em>${inline(a)}</em></p>`).join('');
        out += `<blockquote>${inner}</blockquote>`;
        break;
      }
      case 'text-author': break;
      case 'poem': {
        const pt = first(c, 'title');
        if (pt) out += `<p><strong>${escapeText(titleText(pt))}</strong></p>`;
        for (const e of kids(c, 'epigraph')) out += `<blockquote>${blocks(e, depth)}</blockquote>`;
        for (const st of kids(c, 'stanza')) {
          const lines = kids(st, 'v').map(inline);
          if (lines.length) out += `<p>${lines.join('<br>')}</p>`;
        }
        for (const a of kids(c, 'text-author')) out += `<p><em>${inline(a)}</em></p>`;
        break;
      }
      case 'table': {
        for (const tr of kids(c, 'tr')) {
          const cells = kids(tr).map((td) => inline(td)).filter((s) => s.trim());
          if (cells.length) out += `<p>${cells.join(' | ')}</p>`;
        }
        break;
      }
      case 'section': out += sectionHtml(c, depth + 1); break;
      case 'image': break;
      default: if (c.textContent?.trim()) out += `<p>${inline(c)}</p>`;
    }
  }
  return out;
}

function sectionHtml(sec: Element, depth: number): string {
  const t = titleText(first(sec, 'title'));
  const level = Math.min(3, depth);
  return (t ? `<h${level}>${escapeText(t)}</h${level}>` : '') + blocks(sec, depth);
}

function authorName(a: Element | null): string | null {
  if (!a) return null;
  const name = ['first-name', 'middle-name', 'last-name'].map((n) => text(first(a, n))).filter(Boolean).join(' ');
  return name || text(first(a, 'nickname')) || null;
}

const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0));

export async function parseFb2(buf: ArrayBuffer): Promise<Fb2Result> {
  const doc = parseXml(decodeXmlBytes(buf));
  const root = doc.documentElement;
  if (root.localName !== 'FictionBook') throw new Error('Это не FB2: нет корневого элемента FictionBook.');
  const ti = first(first(root, 'description'), 'title-info');
  const title = text(first(ti, 'book-title')) || null;
  const author = authorName(first(ti, 'author'));
  const units: ImportUnit[] = [];
  const annotation = first(ti, 'annotation');
  if (annotation && text(annotation)) units.push({ html: `<h1>Аннотация</h1>${blocks(annotation, 1)}` });

  const bodies = kids(root, 'body');
  const main = bodies.filter((b) => !b.getAttribute('name') || !/notes|comments/i.test(b.getAttribute('name') ?? ''));
  const notes = bodies.filter((b) => !main.includes(b));
  for (const body of main) {
    // Вступление body до секций (эпиграф книги, title) — отдельным куском.
    const pre = kids(body).filter((c) => c.localName !== 'section' && c.localName !== 'title');
    if (pre.length) {
      const holder = doc.createElementNS(root.namespaceURI, 'section');
      for (const c of pre) holder.appendChild(c.cloneNode(true));
      const html = blocks(holder, 1);
      if (html) units.push({ html });
    }
    for (const sec of kids(body, 'section')) {
      units.push({ html: sectionHtml(sec, 1) });
      await yieldToMain();
    }
  }
  for (const body of notes) {
    const t = titleText(first(body, 'title')) || 'Примечания';
    const html = kids(body, 'section').map((s) => {
      const st = titleText(first(s, 'title'));
      return (st ? `<p><strong>${escapeText(st)}</strong></p>` : '') + blocks(s, 2);
    }).join('');
    if (html) units.push({ html: `<h1>${escapeText(t)}</h1>${html}` });
  }
  return { title, author, units };
}
