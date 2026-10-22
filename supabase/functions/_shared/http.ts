// HTTP-хелперы edge-функций.
//
// CORS только для функций, которые вызывает браузер (create-payment-url, process-refund,
// cancel-subscription, telegram-auth, vk-auth) — белый список origin вместо '*'.
// Вебхуки и cron (robokassa-webhook, payment-result2, billing-scheduler, retention-email,
// payment-confirmation, new-user-notify) браузеру не нужны — без CORS-заголовков.

const ALLOWED_ORIGINS = new Set([
  'https://avtorstudio.com',
  'https://www.avtorstudio.com',
  'https://avtorskaya-studiya.vercel.app',
  'http://localhost:5273',
  'http://127.0.0.1:5273',
]);
const VERCEL_PREVIEW = /^https:\/\/avtorskaya-studiya-[a-z0-9-]+\.vercel\.app$/;

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = ALLOWED_ORIGINS.has(origin) || VERCEL_PREVIEW.test(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'https://avtorstudio.com',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

export function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

export function text(status: number, body: string): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } });
}

/** Первый IP из x-forwarded-for (клиент), иначе x-real-ip. */
export function clientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return req.headers.get('x-real-ip')?.slice(0, 64) ?? null;
}

/** Bearer-токен из Authorization или null. */
export function bearer(req: Request): string | null {
  const h = req.headers.get('Authorization');
  return h?.startsWith('Bearer ') ? h.slice(7) : null;
}

/** Фоновая задача, переживающая возврат ответа (EdgeRuntime.waitUntil, если есть). */
export function runInBackground(p: Promise<unknown>): void {
  const rt = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(p);
  else p.catch(() => {});
}

export const SYSTEM_ADMIN_ID = '00000000-0000-0000-0000-000000000000';
