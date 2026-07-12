// Уведомляет владельца в Telegram о каждой новой регистрации (email/telegram/vk).
// Вызывается асинхронно Postgres-триггером notify_new_user() через pg_net, без пользовательского JWT.
// Защищена shared-secret заголовком X-Webhook-Secret (см. NOTIFY_WEBHOOK_SECRET).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// Constant-time сравнение для webhook-секрета (без тайминг-сайдканала).
function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

const PROVIDER_LABELS: Record<string, string> = {
  email: 'email',
  telegram: 'Telegram',
  vk: 'VK',
};

interface NotifyPayload {
  email: string;
  provider: string;
  created_at: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  const webhookSecret = Deno.env.get('NOTIFY_WEBHOOK_SECRET');
  if (!webhookSecret) return json(500, { error: 'NOTIFY_WEBHOOK_SECRET secret is not set' });
  const providedSecret = req.headers.get('x-webhook-secret');
  if (!providedSecret || !timingSafeEqual(providedSecret, webhookSecret)) {
    return json(401, { error: 'invalid webhook secret' });
  }

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const chatId = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID');
  if (!botToken || !chatId) return json(500, { error: 'telegram secrets are not set' });

  let payload: NotifyPayload;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: 'invalid json' });
  }
  if (!payload.email) return json(400, { error: 'missing email' });

  const providerLabel = PROVIDER_LABELS[payload.provider] ?? payload.provider ?? 'email';
  const createdAt = new Date(payload.created_at || Date.now()).toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
  });
  const text = `Новая регистрация: ${payload.email} (${providerLabel}), ${createdAt}`;

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });

    if (!tgRes.ok) {
      console.error('[new-user-notify] telegram sendMessage failed:', await tgRes.text());
      return json(502, { error: 'telegram send failed' });
    }
  } catch (err) {
    console.error('[new-user-notify] telegram sendMessage failed:', err);
    return json(502, { error: 'telegram send failed' });
  }

  return json(200, { ok: true });
});
