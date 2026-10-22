import { Md5 } from 'https://esm.sh/ts-md5@1.3.1';

export function md5hex(input: string): string {
  return Md5.hashStr(input) as string;
}

/** Сравнение строк за постоянное время (по байтам UTF-8). */
export function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Обрезка пользовательского текста для писем: без переводов строк, не длиннее max. */
export function clip(s: string, max = 80): string {
  const flat = s.replace(/[\r\n\t]+/g, ' ').trim();
  return flat.length > max ? flat.slice(0, max - 1) + '…' : flat;
}
