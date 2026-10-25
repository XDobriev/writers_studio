// Refund API Робокассы (docs.robokassa.ru/ru/refund-api): Refund/Create по OpKey и GetState.
// Общий для process-refund (возврат пользователем) и robokassa-webhook (возврат дубля, L-8).
// Протокол не менялся — код перенесён из process-refund.
import { classifyRefundCreate, type RefundCreateResult } from './robokassa.ts';

function base64url(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** JWT HS256 с ключом Password3 — тело Refund/Create. */
export async function buildRefundJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const header = base64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body   = base64url(enc.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${header}.${body}`));
  return `${header}.${body}.${base64url(new Uint8Array(sig))}`;
}

/** Полный возврат операции. Сетевой сбой — исключение: вызывающий снимает claim. */
export async function createRefund(opKey: string, password3: string): Promise<RefundCreateResult> {
  const jwt = await buildRefundJwt({ OpKey: opKey }, password3);
  // Content-Type: application/json, тело — JWT JSON-строкой (проверено 22.06.2026).
  const res = await fetch('https://services.robokassa.ru/RefundService/Refund/Create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(jwt),
  });
  const raw = await res.text();
  let data: { success?: boolean; message?: string | null; requestId?: string | null } = {};
  try { data = JSON.parse(raw); } catch { /* не JSON — разбираем по сырому тексту */ }
  const result = classifyRefundCreate(data, raw);
  if (result.kind === 'rejected') console.error('[refund] Robokassa rejected:', result.message, res.status);
  return result;
}

/** До 20 с ждём finished/canceled; иначе 'processing' — заявка принята, считаем успехом. */
export async function pollRefundState(requestId: string, tries = 10, delayMs = 2000): Promise<'finished' | 'canceled' | 'processing'> {
  for (let i = 0; i < tries; i++) {
    await new Promise((r) => setTimeout(r, delayMs));
    try {
      const res = await fetch(`https://services.robokassa.ru/RefundService/Refund/GetState?id=${encodeURIComponent(requestId)}`);
      if (res.ok) {
        const data = await res.json() as { label?: string };
        if (data.label === 'finished' || data.label === 'canceled') return data.label;
      }
    } catch { /* retry */ }
  }
  return 'processing';
}
