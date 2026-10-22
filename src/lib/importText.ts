// Импорт TXT и Markdown: определение кодировки и преобразование в HTML.
// Markdown — свой небольшой парсер (заголовки, абзацы, курсив/жирный, списки, цитаты,
// разделители): полноценный CommonMark (marked/markdown-it) тянет лишний вес ради
// подмножества, которое реально встречается в рукописях.

/** UTF-8 (с BOM или без), UTF-16 по BOM, иначе windows-1251 — типичная кодировка старых русских TXT. */
export function decodeText(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return new TextDecoder('utf-8').decode(b.subarray(3));
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b.subarray(2));
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b.subarray(2));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(b);
  } catch {
    return new TextDecoder('windows-1251').decode(b);
  }
}

export function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function splitLines(text: string): string[] {
  return text.replace(/\r\n?/g, '\n').replace(/\u2028|\u2029/g, '\n').split('\n');
}

/**
 * Два стиля TXT: «строка = абзац» (большинство русских файлов) и «жёсткий перенос
 * по ~70 символов, абзацы через пустую строку» (Gutenberg). Второй узнаём по тому,
 * что блоки между пустыми строками — многострочные, а строки короткие и ровные.
 */
function isHardWrapped(lines: string[]): boolean {
  const blocks: number[] = [];
  let cur = 0;
  for (const l of lines) {
    if (l.trim()) cur++;
    else if (cur) { blocks.push(cur); cur = 0; }
  }
  if (cur) blocks.push(cur);
  if (blocks.length < 2) return false;
  const multi = blocks.filter((n) => n > 1).length;
  const lens = lines.filter((l) => l.trim()).map((l) => l.trim().length).sort((a, b) => a - b);
  const p90 = lens[Math.floor(lens.length * 0.9)] ?? 0;
  return multi / blocks.length > 0.5 && p90 <= 100;
}

/** TXT → HTML: абзацы <p>, пустые строки сохраняются как пустой абзац (возможный разрыв сцены). */
export function txtToHtml(text: string): string {
  const lines = splitLines(text);
  const out: string[] = [];
  if (isHardWrapped(lines)) {
    let para: string[] = [];
    const flush = () => {
      if (para.length) out.push(`<p>${escapeText(para.join(' '))}</p>`);
      para = [];
    };
    for (const l of lines) {
      if (l.trim()) para.push(l.trim());
      else flush();
    }
    flush();
    return out.join('');
  }
  for (const l of lines) {
    const t = l.trim();
    out.push(t ? `<p>${escapeText(t)}</p>` : '<p></p>');
  }
  return out.join('');
}

// ─── Markdown ─────────────────────────────────────────────────────────────────

function mdInline(src: string): string {
  // Экранированные символы прячем от разметки.
  const escapes: string[] = [];
  let s = src.replace(/\\([\\`*_{}[\]()#+\-.!~>])/g, (_, c: string) => {
    escapes.push(c);
    return `\u0000${escapes.length - 1}\u0000`;
  });
  s = escapeText(s);
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  s = s.replace(/`([^`]+)`/g, '$1');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^\p{L}\p{N}_])__([^_]+?)__(?=$|[^\p{L}\p{N}_])/gu, '$1<strong>$2</strong>');
  s = s.replace(/\*([^*\s][^*]*?)\*/g, '<em>$1</em>');
  s = s.replace(/(^|[^\p{L}\p{N}_])_([^_\s][^_]*?)_(?=$|[^\p{L}\p{N}_])/gu, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+?)~~/g, '<s>$1</s>');
   
  return s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => escapeText(escapes[Number(i)]));
}

const HR_RE = /^\s*(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/;
const LIST_RE = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;

/** «- Привет, - сказал он.» — диалог через дефис, а не пункт списка. */
function isDialogueLine(rest: string): boolean {
  return /\s[-–—]\s/.test(rest);
}

interface MdState { lines: string[]; i: number; paragraphsByLine: boolean }

function parseMdBlocks(st: MdState, stopIndent = -1): string {
  const out: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (!para.length) return;
    const html = para
      .map((l, idx) => mdInline(l.replace(/\s+$/, '')) + (idx < para.length - 1 ? (/(\s{2,}|\\)$/.test(l) ? '<br>' : ' ') : ''))
      .join('')
      .replace(/\\<br>/g, '<br>');
    out.push(`<p>${html.trim()}</p>`);
    para = [];
  };
  while (st.i < st.lines.length) {
    const line = st.lines[st.i];
    const trimmed = line.trim();
    if (stopIndent >= 0 && trimmed && (line.length - line.trimStart().length) <= stopIndent && !LIST_RE.test(line)) break;
    if (!trimmed) { flush(); st.i++; if (st.paragraphsByLine) out.push('<p></p>'); continue; }
    if (/^```/.test(trimmed)) {
      flush();
      st.i++;
      const code: string[] = [];
      while (st.i < st.lines.length && !/^```/.test(st.lines[st.i].trim())) code.push(st.lines[st.i++]);
      st.i++;
      out.push(`<p>${code.map(escapeText).join('<br>')}</p>`);
      continue;
    }
    const h = trimmed.match(/^(#{1,6})\s+(.*?)\s*#*$/);
    if (h) { flush(); out.push(`<h${h[1].length}>${mdInline(h[2])}</h${h[1].length}>`); st.i++; continue; }
    const next = st.lines[st.i + 1]?.trim() ?? '';
    if (para.length === 0 && /^=+$/.test(next)) { out.push(`<h1>${mdInline(trimmed)}</h1>`); st.i += 2; continue; }
    if (para.length === 0 && /^-+$/.test(next) && next.length >= 2 && !HR_RE.test(trimmed)) {
      out.push(`<h2>${mdInline(trimmed)}</h2>`); st.i += 2; continue;
    }
    if (HR_RE.test(trimmed)) { flush(); out.push('<hr>'); st.i++; continue; }
    if (trimmed.startsWith('>')) {
      flush();
      const inner: string[] = [];
      while (st.i < st.lines.length && st.lines[st.i].trim().startsWith('>')) {
        inner.push(st.lines[st.i].trim().replace(/^>\s?/, ''));
        st.i++;
      }
      const sub: MdState = { lines: inner, i: 0, paragraphsByLine: st.paragraphsByLine };
      out.push(`<blockquote>${parseMdBlocks(sub)}</blockquote>`);
      continue;
    }
    const li = line.match(LIST_RE);
    if (li && !isDialogueLine(li[3])) {
      flush();
      out.push(parseMdList(st));
      continue;
    }
    if (st.paragraphsByLine) { out.push(`<p>${mdInline(trimmed)}</p>`); st.i++; continue; }
    para.push(line.trim() + (/\s{2,}$/.test(line) ? '  ' : ''));
    st.i++;
  }
  flush();
  return out.join('');
}

function parseMdList(st: MdState): string {
  const first = st.lines[st.i].match(LIST_RE)!;
  const indent = first[1].length;
  const ordered = /\d/.test(first[2]);
  const start = ordered ? parseInt(first[2], 10) : 1;
  const items: string[] = [];
  while (st.i < st.lines.length) {
    const m = st.lines[st.i].match(LIST_RE);
    if (!m || m[1].length !== indent || /\d/.test(m[2]) !== ordered || isDialogueLine(m[3])) break;
    st.i++;
    let body = `<p>${mdInline(m[3])}</p>`;
    // Вложенное: строки с бо́льшим отступом.
    const nested = st.lines[st.i]?.match(LIST_RE);
    if (nested && nested[1].length > indent) body += parseMdList(st);
    items.push(`<li>${body}</li>`);
  }
  const tag = ordered ? 'ol' : 'ul';
  return `<${tag}${ordered && start !== 1 ? ` start="${start}"` : ''}>${items.join('')}</${tag}>`;
}

export function markdownToHtml(text: string): string {
  const lines = splitLines(text);
  const nonEmpty = lines.filter((l) => l.trim()).length;
  const blank = lines.length - nonEmpty;
  // Рукопись без пустых строк между абзацами — «строка = абзац», а не один огромный абзац.
  const paragraphsByLine = nonEmpty > 5 && blank < nonEmpty * 0.1;
  return parseMdBlocks({ lines, i: 0, paragraphsByLine });
}
