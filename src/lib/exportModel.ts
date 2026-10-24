// Единый обход HTML главы (формат TipTap) в промежуточную модель «блоки + инлайн-раны».
// Её рендерят DOCX, FB2, Markdown и TXT — поэтому потеря текста (код-блок, второй абзац
// в пункте списка, вложенный список) чинится в одном месте, а не в каждом экспортёре.

type Mark = 'b' | 'i' | 'u' | 's' | 'sub' | 'sup' | 'code';

export type Run =
  | { kind: 'text'; text: string; marks: Mark[]; href?: string }
  | { kind: 'br' };

export type Align = 'center' | 'right' | 'justify';

export type Block =
  | { kind: 'p'; runs: Run[]; align?: Align }
  | { kind: 'heading'; level: number; runs: Run[] }
  | { kind: 'quote'; blocks: Block[] }
  | { kind: 'list'; ordered: boolean; start: number; items: Block[][] }
  | { kind: 'code'; lines: string[] }
  | { kind: 'hr' };

const BLOCK_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'ul', 'ol', 'li', 'pre', 'hr',
  'div', 'section', 'article', 'header', 'footer', 'aside', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'figure', 'dl', 'dt', 'dd',
]);
const SKIP_TAGS = new Set(['script', 'style', 'img', 'svg', 'input', 'label', 'button', 'video', 'audio', 'iframe', 'template']);

function isBlockEl(n: Node): boolean {
  return n.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((n as Element).tagName.toLowerCase());
}

const MARK_BY_TAG: Record<string, Mark> = {
  strong: 'b', b: 'b', em: 'i', i: 'i', u: 'u', s: 's', del: 's', strike: 's',
  sub: 'sub', sup: 'sup', code: 'code',
};

function collectRuns(nodes: Iterable<Node>, marks: Mark[] = [], href?: string, out: Run[] = []): Run[] {
  for (const n of nodes) {
    if (n.nodeType === Node.TEXT_NODE) {
      // Перевод строки в HTML-разметке — это пробел, а не разрыв.
      const text = (n.textContent ?? '').replace(/[\r\n\t]+/g, ' ');
      if (text) out.push({ kind: 'text', text, marks, ...(href ? { href } : {}) });
      continue;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) continue;
    const el = n as Element;
    const tag = el.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) continue;
    if (tag === 'br') { out.push({ kind: 'br' }); continue; }
    const m = MARK_BY_TAG[tag];
    const nextMarks = m && !marks.includes(m) ? [...marks, m] : marks;
    let nextHref = href;
    if (tag === 'a') {
      const h = el.getAttribute('href') ?? '';
      if (/^(https?:|mailto:)/i.test(h)) nextHref = h;
    }
    collectRuns(el.childNodes, nextMarks, nextHref, out);
  }
  return out;
}

/** Убирает пробелы по краям абзаца и пустые раны. */
function trimRuns(runs: Run[]): Run[] {
  const r = runs.filter((x) => x.kind === 'br' || x.text !== '');
  while (r.length && r[r.length - 1].kind === 'br') r.pop();
  const first = r[0];
  if (first?.kind === 'text') r[0] = { ...first, text: first.text.replace(/^[ ]+/, '') };
  const lastIdx = r.length - 1;
  const last = r[lastIdx];
  if (last?.kind === 'text') r[lastIdx] = { ...last, text: last.text.replace(/[ ]+$/, '') };
  return r.filter((x) => x.kind === 'br' || x.text !== '');
}

function alignOf(el: Element): Align | undefined {
  const a = (el.getAttribute('style') ?? '').match(/text-align:\s*(center|right|justify)/i)?.[1];
  return a ? (a.toLowerCase() as Align) : undefined;
}

function parseChildren(parent: Node): Block[] {
  const out: Block[] = [];
  let inline: Node[] = [];
  const flush = () => {
    if (!inline.length) return;
    const runs = trimRuns(collectRuns(inline));
    if (runs.length) out.push({ kind: 'p', runs });
    inline = [];
  };
  for (const n of Array.from(parent.childNodes)) {
    if (n.nodeType === Node.ELEMENT_NODE && SKIP_TAGS.has((n as Element).tagName.toLowerCase())) continue;
    if (isBlockEl(n)) { flush(); out.push(...parseBlock(n as Element)); }
    else inline.push(n);
  }
  flush();
  return out;
}

function parseBlock(el: Element): Block[] {
  const tag = el.tagName.toLowerCase();
  if (tag === 'p') {
    // Блочные дети внутри <p> встречаются только в «грязном» HTML — не теряем их.
    if (Array.from(el.childNodes).some(isBlockEl)) return parseChildren(el);
    const align = alignOf(el);
    return [{ kind: 'p', runs: trimRuns(collectRuns(el.childNodes)), ...(align ? { align } : {}) }];
  }
  if (/^h[1-6]$/.test(tag)) {
    return [{ kind: 'heading', level: Number(tag[1]), runs: trimRuns(collectRuns(el.childNodes)) }];
  }
  if (tag === 'blockquote') return [{ kind: 'quote', blocks: parseChildren(el) }];
  if (tag === 'ul' || tag === 'ol') {
    const items = Array.from(el.children)
      .filter((c) => c.tagName.toLowerCase() === 'li')
      .map((li) => parseChildren(li));
    const start = Number(el.getAttribute('start') ?? '1');
    return [{ kind: 'list', ordered: tag === 'ol', start: Number.isFinite(start) ? start : 1, items }];
  }
  if (tag === 'li') return parseChildren(el);
  if (tag === 'pre') {
    const lines = (el.textContent ?? '').replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n');
    return [{ kind: 'code', lines }];
  }
  if (tag === 'hr') return [{ kind: 'hr' }];
  return parseChildren(el);
}

export function parseHtmlBlocks(html: string): Block[] {
  if (!html || !html.trim()) return [];
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  return parseChildren(doc.body);
}

export function runsText(runs: Run[]): string {
  return runs.map((r) => (r.kind === 'br' ? '\n' : r.text)).join('');
}

/** Делит раны по <br> на строки (стихи, адреса — в FB2 это отдельные <p>). */
export function splitRunsByBr(runs: Run[]): Run[][] {
  const lines: Run[][] = [[]];
  for (const r of runs) {
    if (r.kind === 'br') lines.push([]);
    else lines[lines.length - 1].push(r);
  }
  return lines;
}

// ─── XHTML-сериализация (EPUB) ────────────────────────────────────────────────

const VOID_TAGS = new Set(['br', 'hr', 'img', 'col', 'wbr', 'area', 'source', 'track']);
// Символы, запрещённые в XML 1.0 (управляющие, кроме \t \n \r).
const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

export function stripXmlInvalid(s: string): string {
  return s.replace(XML_INVALID, '');
}

function escText(s: string): string {
  return stripXmlInvalid(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s: string): string {
  return escText(s).replace(/"/g, '&quot;');
}

/**
 * Сериализует DOM-узлы как XHTML: самозакрывающиеся void-теги, U+00A0 литералом,
 * без HTML-сущностей. Атрибуты с невалидными для XML именами и data-* отбрасываются.
 */
export function serializeXhtml(nodes: Iterable<Node>): string {
  let out = '';
  for (const n of nodes) {
    if (n.nodeType === Node.TEXT_NODE) { out += escText(n.textContent ?? ''); continue; }
    if (n.nodeType !== Node.ELEMENT_NODE) continue;
    const el = n as Element;
    const tag = el.tagName.toLowerCase();
    if (!/^[a-z][a-z0-9]*$/.test(tag)) { out += serializeXhtml(el.childNodes); continue; }
    let attrs = '';
    for (const a of Array.from(el.attributes)) {
      const name = a.name.toLowerCase();
      if (name.startsWith('data-') || name === 'contenteditable' || !/^[a-z][a-z0-9-]*$/.test(name)) continue;
      attrs += ` ${name}="${escAttr(a.value)}"`;
    }
    if (VOID_TAGS.has(tag)) { out += `<${tag}${attrs}/>`; continue; }
    out += `<${tag}${attrs}>${serializeXhtml(el.childNodes)}</${tag}>`;
  }
  return out;
}
