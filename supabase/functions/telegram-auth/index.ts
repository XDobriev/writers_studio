// Telegram Login Widget callback.
// Принимает auth_data от https://telegram.org/js/telegram-widget.js, валидирует HMAC-подпись
// по схеме https://core.telegram.org/widgets/login#checking-authorization, создаёт/находит
// пользователя в Supabase и возвращает одноразовый token_hash для verifyOtp на фронте.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

interface TelegramAuthData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function verifyTelegramSignature(data: TelegramAuthData, botToken: string): Promise<boolean> {
  const { hash, ...rest } = data;
  const dataCheckString = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${(rest as Record<string, unknown>)[k]}`)
    .join('\n');

  const enc = new TextEncoder();
  const secretKey = await crypto.subtle.digest('SHA-256', enc.encode(botToken));
  const key = await crypto.subtle.importKey(
    'raw',
    secretKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(dataCheckString));
  return toHex(sig) === hash;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!botToken) return json(500, { error: 'TELEGRAM_BOT_TOKEN secret is not set' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return json(500, { error: 'supabase env is not set' });

  let data: TelegramAuthData;
  try {
    data = await req.json();
  } catch {
    return json(400, { error: 'invalid json' });
  }

  if (!data.id || !data.hash || !data.auth_date) {
    return json(400, { error: 'missing required fields' });
  }

  const ageSec = Math.floor(Date.now() / 1000) - data.auth_date;
  if (ageSec > 24 * 60 * 60) {
    return json(401, { error: 'auth_date is older than 24h' });
  }

  const ok = await verifyTelegramSignature(data, botToken);
  if (!ok) return json(401, { error: 'invalid telegram signature' });

  const email = `tg-${data.id}@telegram.local`;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const meta = {
    telegram_id: data.id,
    telegram_username: data.username ?? null,
    first_name: data.first_name ?? null,
    last_name: data.last_name ?? null,
    photo_url: data.photo_url ?? null,
    provider: 'telegram',
  };

  // Поиск существующего юзера. Дешевле через listUsers c фильтром по email
  // (Supabase admin API сейчас не отдаёт getUserByEmail).
  let userId: string | null = null;
  for (let page = 1; page <= 5; page++) {
    const { data: list, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error('[telegram-auth] listUsers failed:', error.message);
      return json(500, { error: 'auth lookup failed' });
    }
    const hit = list.users.find((u) => u.email === email);
    if (hit) { userId = hit.id; break; }
    if (list.users.length < 200) break;
  }

  if (!userId) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: meta,
    });
    if (error || !created.user) {
      console.error('[telegram-auth] createUser failed:', error?.message ?? 'unknown');
      return json(500, { error: 'account creation failed' });
    }
    userId = created.user.id;
  } else {
    await admin.auth.admin.updateUserById(userId, { user_metadata: meta });
  }

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkErr || !link.properties) {
    console.error('[telegram-auth] generateLink failed:', linkErr?.message ?? 'unknown');
    return json(500, { error: 'login link generation failed' });
  }

  return json(200, {
    token_hash: link.properties.hashed_token,
    email,
  });
});
