// Картинки импортируемой рукописи. Парсеры кладут в HTML `<img data-import-id="…">` без src,
// а байты — в ImportImages; при создании книги файлы уходят в Storage (chapterImages.ts),
// и метка заменяется на public URL. Так в главу не попадает base64.

export interface ImportImage {
  bytes: Uint8Array;
  mime: string;
}

export type ImportImages = Map<string, ImportImage>;

export const IMPORT_IMAGE_ATTR = 'data-import-id';

const IMG_TAG_RE = /<img\b[^>]*?\sdata-import-id="([^"]+)"[^>]*>/g;

export function referencedImageIds(html: string): string[] {
  return Array.from(html.matchAll(IMG_TAG_RE), (m) => m[1]);
}

/** Метка → `<img src>`; картинка без URL (не загрузилась) — убирается. */
export function rewriteImportImages(html: string, urlById: Map<string, string>): string {
  return html.replace(IMG_TAG_RE, (_m, id: string) => {
    const url = urlById.get(id);
    return url ? `<img src="${url.replace(/"/g, '&quot;')}">` : '';
  });
}

export function imageExtension(mime: string): string | null {
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/gif') return 'gif';
  if (mime === 'image/webp') return 'webp';
  return null;
}

export function mimeFromFileName(name: string): string | null {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  return null;
}
