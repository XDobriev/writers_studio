export const TELEGRAM_AUTH_FIELDS = ['id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date', 'hash'];

export interface TelegramAuthData {
  id: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number | string;
  hash: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): boolean {
  return (typeof value === 'number' || (typeof value === 'string' && /^[1-9]\d*$/.test(value)))
    && Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

export function isTelegramAuthData(value: unknown): value is TelegramAuthData {
  return isRecord(value)
    && Object.keys(value).every((key) => TELEGRAM_AUTH_FIELDS.includes(key))
    && isPositiveInteger(value.id) && isPositiveInteger(value.auth_date)
    && typeof value.hash === 'string' && /^[\da-f]{64}$/i.test(value.hash)
    && ['first_name', 'last_name', 'username', 'photo_url'].every((key) => !(key in value) || typeof value[key] === 'string');
}

export function isTelegramAuthDateValid(data: TelegramAuthData, nowSec = Math.floor(Date.now() / 1000)): boolean {
  const age = nowSec - Number(data.auth_date);
  return Number.isFinite(age) && age <= 15 * 60 && age >= -60;
}

export async function verifyTelegramSignature(data: TelegramAuthData, botToken: string): Promise<boolean> {
  const { hash, ...rest } = data;
  // Keep redirect strings verbatim: decoding or normalizing them again breaks Telegram's HMAC.
  const fields: Record<string, unknown> = rest;
  const check = Object.keys(fields).sort().map((key) => `${key}=${fields[key]}`).join('\n');
  const enc = new TextEncoder();
  const secret = await crypto.subtle.digest('SHA-256', enc.encode(botToken));
  const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const signature = Uint8Array.from(hash.match(/../g) ?? [], (byte) => parseInt(byte, 16));
  return crypto.subtle.verify('HMAC', key, signature, enc.encode(check));
}
