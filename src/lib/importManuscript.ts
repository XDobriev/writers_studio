import { decodeText, markdownToHtml, txtToHtml } from './importText';
import { normalizeImportHtml } from './importSanitize';
import type { ImportUnit } from './importSplit';
import type { ImportImages } from './importImages';

// Импорт рукописи: определение формата, разбор файла, нормализация HTML.
// Разбивка на главы — importSplit.ts, создание книги — useManuscriptImport.

export type ImportFormat = 'docx' | 'txt' | 'md' | 'fb2' | 'epub';

/** FB2 и EPUB — Pro: это переезд с площадок (Author.Today, Литнет), DOCX/TXT/MD — бесплатно. */
export const PRO_IMPORT_FORMATS: readonly ImportFormat[] = ['fb2', 'epub'];

export const IMPORT_ACCEPT = '.docx,.doc,.dot,.txt,.md,.markdown,.fb2,.epub';

export const DOC_UNSUPPORTED_ERROR =
  'Формат .doc / .dot (Word 97–2003) не поддерживается. Пожалуйста, откройте файл в Word или Google Документах, сохраните как .docx и загрузите снова.';

export const DOC_RENAMED_ERROR =
  'Файл сохранён в старом формате .doc (Word 97–2003). Переименование файла в .docx не меняет его структуру: откройте его в Word или Google Документах, сохраните как .docx и загрузите снова.';

function fileExtension(fileName: string): string | null {
  return fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? null;
}

export function isLegacyWordFileName(fileName: string): boolean {
  const ext = fileExtension(fileName);
  return ext === 'doc' || ext === 'dot';
}

/** Проверка сигнатуры OLE2 Compound Document (Word 97–2003 .doc): D0 CF 11 E0 A1 B1 1A E1 */
export function isOleCompoundDocument(data: ArrayBuffer | null | undefined): boolean {
  if (!data || data.byteLength < 8) return false;
  const h = new Uint8Array(data, 0, 8);
  return (
    h[0] === 0xd0 &&
    h[1] === 0xcf &&
    h[2] === 0x11 &&
    h[3] === 0xe0 &&
    h[4] === 0xa1 &&
    h[5] === 0xb1 &&
    h[6] === 0x1a &&
    h[7] === 0xe1
  );
}

const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

export interface ParsedManuscript {
  format: ImportFormat;
  title: string;
  author: string | null;
  units: ImportUnit[];
  /** Картинки по метке `data-import-id`; у TXT/MD пусто. */
  images: ImportImages;
}

export function detectImportFormat(fileName: string): ImportFormat | null {
  const ext = fileExtension(fileName);
  if (ext === 'docx') return 'docx';
  if (ext === 'txt' || ext === 'text') return 'txt';
  if (ext === 'md' || ext === 'markdown') return 'md';
  if (ext === 'fb2') return 'fb2';
  if (ext === 'epub') return 'epub';
  return null;
}

function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return base || 'Импортированная рукопись';
}

const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0));

async function normalizeUnits(units: ImportUnit[]): Promise<ImportUnit[]> {
  const out: ImportUnit[] = [];
  for (const u of units) {
    const html = normalizeImportHtml(u.html);
    if (html) out.push({ ...u, html });
    await yieldToMain();
  }
  return out;
}

export async function parseManuscript(data: ArrayBuffer, fileName: string): Promise<ParsedManuscript> {
  if (isLegacyWordFileName(fileName)) throw new Error(DOC_UNSUPPORTED_ERROR);
  if (isOleCompoundDocument(data)) throw new Error(DOC_RENAMED_ERROR);

  const format = detectImportFormat(fileName);
  if (!format) throw new Error('Неподдерживаемый формат. Можно загрузить DOCX, TXT, Markdown, FB2 или EPUB.');
  if (data.byteLength > MAX_IMPORT_BYTES) throw new Error('Файл больше 20 МБ — разделите рукопись на части.');
  if (data.byteLength === 0) throw new Error('Файл пустой.');

  let title: string | null = null;
  let author: string | null = null;
  let units: ImportUnit[];
  let images: ImportImages = new Map();

  if (format === 'docx') {
    const { parseDocx } = await import('./importDocx');
    let r;
    try {
      r = await parseDocx(data);
    } catch {
      throw new Error('Не удалось прочитать DOCX. Если файл изначально был в формате .doc — пересохраните его в Word или Google Документах как .docx.');
    }
    ({ title, author } = r);
    units = [{ html: r.html }];
    images = r.images;
  } else if (format === 'fb2') {
    const { parseFb2 } = await import('./importFb2');
    const r = await parseFb2(data);
    ({ title, author, units, images } = r);
  } else if (format === 'epub') {
    const { parseEpub } = await import('./importEpub');
    const r = await parseEpub(data);
    ({ title, author, units, images } = r);
  } else {
    const text = decodeText(data);
    units = [{ html: format === 'md' ? markdownToHtml(text) : txtToHtml(text) }];
  }

  await yieldToMain();
  const normalized = await normalizeUnits(units);
  if (!normalized.length) throw new Error('В файле не найден текст.');
  return {
    format,
    title: (title ?? '').trim().slice(0, 120) || titleFromFileName(fileName).slice(0, 120),
    author: author?.trim().slice(0, 120) || null,
    units: normalized,
    images,
  };
}
