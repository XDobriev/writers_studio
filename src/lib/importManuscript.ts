import { decodeText, markdownToHtml, txtToHtml } from './importText';
import { normalizeImportHtml } from './importSanitize';
import type { ImportUnit } from './importSplit';

// Импорт рукописи: определение формата, разбор файла, нормализация HTML.
// Разбивка на главы — importSplit.ts, создание книги — useManuscriptImport.

export type ImportFormat = 'docx' | 'txt' | 'md' | 'fb2' | 'epub';

/** FB2 и EPUB — Pro: это переезд с площадок (Author.Today, Литнет), DOCX/TXT/MD — бесплатно. */
export const PRO_IMPORT_FORMATS: readonly ImportFormat[] = ['fb2', 'epub'];

export const IMPORT_ACCEPT = '.docx,.txt,.md,.markdown,.fb2,.epub';

const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

export interface ParsedManuscript {
  format: ImportFormat;
  title: string;
  author: string | null;
  units: ImportUnit[];
}

export function detectImportFormat(fileName: string): ImportFormat | null {
  const ext = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
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
  const format = detectImportFormat(fileName);
  if (!format) throw new Error('Неподдерживаемый формат. Можно загрузить DOCX, TXT, Markdown, FB2 или EPUB.');
  if (data.byteLength > MAX_IMPORT_BYTES) throw new Error('Файл больше 20 МБ — разделите рукопись на части.');
  if (data.byteLength === 0) throw new Error('Файл пустой.');

  let title: string | null = null;
  let author: string | null = null;
  let units: ImportUnit[];

  if (format === 'docx') {
    const { parseDocx } = await import('./importDocx');
    let r;
    try {
      r = await parseDocx(data);
    } catch {
      throw new Error('Не удалось прочитать DOCX. Если файл в старом формате .doc — пересохраните его в Word как .docx.');
    }
    ({ title, author } = r);
    units = [{ html: r.html }];
  } else if (format === 'fb2') {
    const { parseFb2 } = await import('./importFb2');
    const r = await parseFb2(data);
    ({ title, author, units } = r);
  } else if (format === 'epub') {
    const { parseEpub } = await import('./importEpub');
    const r = await parseEpub(data);
    ({ title, author, units } = r);
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
  };
}
