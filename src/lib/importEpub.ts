import JSZip from 'jszip';
import type { ImportUnit } from './importSplit';
import { IMPORT_IMAGE_ATTR, mimeFromFileName, type ImportImages } from './importImages';

// EPUB → куски по spine: каждый XHTML-файл — кандидат в главу, название — из оглавления
// (nav.xhtml / toc.ncx), если в самом файле нет заголовка. Обложка, оглавление-страница
// и файлы без текста пропускаются.

export interface EpubResult {
  title: string | null;
  author: string | null;
  units: ImportUnit[];
  images: ImportImages;
}

function parseXml(text: string, type: DOMParserSupportedType = 'application/xml'): Document | null {
  const doc = new DOMParser().parseFromString(text, type);
  return doc.getElementsByTagName('parsererror').length ? null : doc;
}

function byLocalName(root: Document | Element, name: string): Element[] {
  return Array.from(root.getElementsByTagName('*')).filter((e) => e.localName === name);
}

function dirOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i >= 0 ? path.slice(0, i + 1) : '';
}

function resolvePath(base: string, href: string): string {
  const parts = (base + href).split('/');
  const out: string[] = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p !== '.' && p !== '') out.push(p);
  }
  return out.join('/');
}

function stripFragment(href: string): string {
  const raw = href.split('#')[0];
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

async function readText(zip: JSZip, path: string): Promise<string | null> {
  const f = zip.file(path) ?? Object.values(zip.files).find((x) => x.name.toLowerCase() === path.toLowerCase()) ?? null;
  return f ? f.async('string') : null;
}

/** Оглавление: путь файла → название (первое вхождение). */
async function readToc(zip: JSZip, opfDir: string, manifest: Map<string, { href: string; type: string; props: string }>, spineToc: string | null) {
  const labels = new Map<string, string>();
  const navItem = [...manifest.values()].find((m) => m.props.split(/\s+/).includes('nav'));
  if (navItem) {
    const navPath = resolvePath(opfDir, navItem.href);
    const xml = await readText(zip, navPath);
    const doc = xml ? parseXml(xml, 'application/xhtml+xml') ?? parseXml(xml, 'text/html') : null;
    if (doc) {
      const navs = byLocalName(doc, 'nav');
      const toc = navs.find((n) => (n.getAttribute('epub:type') ?? n.getAttributeNS('http://www.idpf.org/2007/ops', 'type') ?? '').includes('toc')) ?? navs[0];
      for (const a of toc ? byLocalName(toc, 'a') : []) {
        const href = a.getAttribute('href');
        const label = (a.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (!href || !label) continue;
        const p = resolvePath(dirOf(navPath), stripFragment(href));
        if (!labels.has(p)) labels.set(p, label);
      }
    }
  }
  if (!labels.size && spineToc) {
    const ncx = manifest.get(spineToc);
    const ncxPath = ncx ? resolvePath(opfDir, ncx.href) : null;
    const xml = ncxPath ? await readText(zip, ncxPath) : null;
    const doc = xml ? parseXml(xml) : null;
    if (doc && ncxPath) {
      for (const np of byLocalName(doc, 'navPoint')) {
        const label = (byLocalName(np, 'text')[0]?.textContent ?? '').replace(/\s+/g, ' ').trim();
        const src = byLocalName(np, 'content')[0]?.getAttribute('src');
        if (!src || !label) continue;
        const p = resolvePath(dirOf(ncxPath), stripFragment(src));
        if (!labels.has(p)) labels.set(p, label);
      }
    }
  }
  return labels;
}

/** Страница-оглавление внутри книги: почти весь текст — ссылки. */
function isTocPage(body: Element): boolean {
  const total = (body.textContent ?? '').replace(/\s+/g, '').length;
  if (!total) return false;
  const links = byLocalName(body, 'a').reduce((s, a) => s + (a.textContent ?? '').replace(/\s+/g, '').length, 0);
  return links / total > 0.8 && byLocalName(body, 'a').length >= 3;
}

/** Титульный лист: пара строк, среди которых название книги. */
function isTitlePage(body: Element, title: string | null): boolean {
  if (!title) return false;
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const text = body.textContent ?? '';
  const words = text.split(/\s+/).filter(Boolean).length;
  const t = norm(title);
  return words <= 25 && !!t && norm(text).includes(t) && norm(text).length <= t.length + 80;
}

/** `<img src>` XHTML-файла → метка + байты из архива; картинка вне архива или не растровая — убирается. */
async function extractImages(zip: JSZip, body: Element, filePath: string, images: ImportImages, byPath: Map<string, string>) {
  for (const img of byLocalName(body, 'img')) {
    const src = img.getAttribute('src') ?? '';
    const path = /^(https?:|data:)/i.test(src) ? null : resolvePath(dirOf(filePath), stripFragment(src));
    const mime = path ? mimeFromFileName(path) : null;
    if (!path || !mime) { img.remove(); continue; }
    let id = byPath.get(path);
    if (!id) {
      const f = zip.file(path) ?? Object.values(zip.files).find((x) => x.name.toLowerCase() === path.toLowerCase());
      if (!f) { img.remove(); continue; }
      id = `img${images.size + 1}`;
      images.set(id, { bytes: await f.async('uint8array'), mime });
      byPath.set(path, id);
    }
    for (const a of Array.from(img.attributes)) img.removeAttribute(a.name);
    img.setAttribute(IMPORT_IMAGE_ATTR, id);
  }
}

const yieldToMain =() => new Promise<void>((r) => setTimeout(r, 0));

export async function parseEpub(buf: ArrayBuffer): Promise<EpubResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch {
    throw new Error('Файл EPUB повреждён: это не ZIP-архив.');
  }
  const container = await readText(zip, 'META-INF/container.xml');
  const cdoc = container ? parseXml(container) : null;
  const opfPath = cdoc ? byLocalName(cdoc, 'rootfile')[0]?.getAttribute('full-path') : null;
  const opfXml = opfPath ? await readText(zip, opfPath) : null;
  const opf = opfXml ? parseXml(opfXml) : null;
  if (!opf || !opfPath) throw new Error('Файл EPUB повреждён: не найдено описание книги (OPF).');
  const opfDir = dirOf(opfPath);

  const title = (byLocalName(opf, 'title')[0]?.textContent ?? '').trim() || null;
  const author = (byLocalName(opf, 'creator')[0]?.textContent ?? '').trim() || null;

  const manifest = new Map<string, { href: string; type: string; props: string }>();
  for (const it of byLocalName(opf, 'item')) {
    const id = it.getAttribute('id');
    const href = it.getAttribute('href');
    if (id && href) manifest.set(id, { href: stripFragment(href), type: it.getAttribute('media-type') ?? '', props: it.getAttribute('properties') ?? '' });
  }
  const spine = byLocalName(opf, 'spine')[0];
  const toc = await readToc(zip, opfDir, manifest, spine?.getAttribute('toc') ?? null);

  const units: ImportUnit[] = [];
  const images: ImportImages = new Map();
  const imageIdByPath = new Map<string, string>();
  const htmlDoc = document.implementation.createHTMLDocument('');
  for (const ref of spine ? byLocalName(spine, 'itemref') : []) {
    const item = manifest.get(ref.getAttribute('idref') ?? '');
    if (!item || item.props.split(/\s+/).includes('nav')) continue;
    if (!/x?html|xml/i.test(item.type)) continue;
    const path = resolvePath(opfDir, item.href);
    const xml = await readText(zip, path);
    if (!xml) continue;
    const doc = parseXml(xml, 'application/xhtml+xml') ?? parseXml(xml, 'text/html');
    const body = doc ? byLocalName(doc, 'body')[0] : null;
    if (!body || !((body.textContent ?? '').trim() || byLocalName(body, 'img').length) || isTocPage(body) || (units.length === 0 && isTitlePage(body, title))) continue;
    await extractImages(zip, body, path, images, imageIdByPath);
    // Импорт XHTML-узлов в HTML-документ: innerHTML даёт обычный HTML без xmlns.
    const imported = htmlDoc.importNode(body, true);
    const holder = htmlDoc.createElement('div');
    while (imported.firstChild) holder.appendChild(imported.firstChild);
    units.push({ html: holder.innerHTML, title: toc.get(path) });
    await yieldToMain();
  }
  return { title, author, units, images };
}
