import JSZip from 'jszip';
import { IMPORT_IMAGE_ATTR, type ImportImages } from './importImages';

// DOCX → HTML через mammoth (грузится динамически — отдельный чанк, как docx в экспорте).
// Стили Word «Заголовок 1/2/3» → h1–h3 (по ним режем на главы), «Название» → h1
// (титульная строка потом отбрасывается, если совпала с названием книги).

export interface DocxResult {
  title: string | null;
  author: string | null;
  html: string;
  images: ImportImages;
}

const STYLE_MAP = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Название'] => h1:fresh",
  "p[style-name='Subtitle'] => h3:fresh",
  "p[style-name='Подзаголовок'] => h3:fresh",
  "p[style-name='heading 1'] => h1:fresh",
  "p[style-name='heading 2'] => h2:fresh",
  "p[style-name='heading 3'] => h3:fresh",
  "p[style-name='Заголовок 1'] => h1:fresh",
  "p[style-name='Заголовок 2'] => h2:fresh",
  "p[style-name='Заголовок 3'] => h3:fresh",
  'u => u',
  'strike => s',
];

/** Название и автор из docProps/core.xml — mammoth их не отдаёт. */
async function readCoreProps(buf: ArrayBuffer): Promise<{ title: string | null; author: string | null }> {
  try {
    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file('docProps/core.xml')?.async('string');
    if (!xml) return { title: null, author: null };
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const get = (name: string) => {
      const el = Array.from(doc.getElementsByTagName('*')).find((e) => e.localName === name);
      return (el?.textContent ?? '').trim() || null;
    };
    return { title: get('title'), author: get('creator') };
  } catch {
    return { title: null, author: null };
  }
}

function nodeBufferInput(buf: ArrayBuffer): { buffer?: never } {
  const B = (globalThis as unknown as { Buffer?: { from(b: ArrayBuffer): never } }).Buffer;
  return B ? { buffer: B.from(buf) } : {};
}

export async function parseDocx(buf: ArrayBuffer): Promise<DocxResult> {
  const images: ImportImages = new Map();
  const { default: mammoth } = await import('mammoth');
  const [props, result] = await Promise.all([
    readCoreProps(buf),
    mammoth.convertToHtml(
      // Браузерная сборка mammoth читает arrayBuffer; node-сборка (vitest) — только buffer.
      { arrayBuffer: buf, ...nodeBufferInput(buf) },
      {
        styleMap: STYLE_MAP,
        // Пустые абзацы нужны нам: подряд идущие — разрыв сцены (normalizeImportHtml решает сам).
        ignoreEmptyParagraphs: false,
        // Картинка — метка в HTML, байты — в images: в Storage они уйдут при создании книги.
        convertImage: mammoth.images.imgElement(async (image) => {
          const id = `img${images.size + 1}`;
          // read() без кодировки в браузерной сборке требует Buffer — его там нет, mammoth молча теряет картинку.
          const bin = atob(await image.read('base64'));
          images.set(id, { bytes: Uint8Array.from(bin, (c) => c.charCodeAt(0)), mime: image.contentType });
          return { src: '', [IMPORT_IMAGE_ATTR]: id };
        }),
      },
    ),
  ]);
  return { title: props.title, author: props.author, html: result.value, images };
}
