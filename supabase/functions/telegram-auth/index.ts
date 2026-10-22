// Telegram Login Widget callback.
// Принимает auth_data от https://telegram.org/js/telegram-widget.js, валидирует HMAC-подпись
// по схеме https://core.telegram.org/widgets/login#checking-authorization, создаёт/находит
// пользователя в Supabase и возвращает одноразовый token_hash для verifyOtp на фронте.
//
// Защита: hash сравнивается за постоянное время; auth_date не старше 15 минут и не из
// будущего (допуск 60 с); новые аккаунты не создаются при registration_open = false;
// поиск существующего пользователя — RPC find_auth_user_by_email (без лимита 1000).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { timingSafeEqual } from '../_shared/crypto.ts';
import { corsHeaders, json } from '../_shared/http.ts';
import { findUserByEmail, isRegistrationOpen } from '../_shared/authUsers.ts';

interface TelegramAuthData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

const MAX_AGE_SEC = 15 * 60;
const MAX_FUTURE_SKEW_SEC = 60;

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
  const key = await crypto.subtle.importKey('raw', secretKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(dataCheckString));
  return timingSafeEqual(toHex(sig), String(hash).toLowerCase());
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' }, cors);

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!botToken || !supabaseUrl || !serviceKey) {
    console.error('[telegram-auth] missing env');
    return json(500, { error: 'server misconfigured' }, cors);
  }

  let data: TelegramAuthData;
  try {
    data = await req.json();
  } catch {
    return json(400, { error: 'invalid json' }, cors);
  }

  if (!data?.id || !data.hash || !data.auth_date || !Number.isInteger(Number(data.id))) {
    return json(400, { error: 'missing required fields' }, cors);
  }

  const ageSec = Math.floor(Date.now() / 1000) - Number(data.auth_date);
  if (!Number.isFinite(ageSec) || ageSec > MAX_AGE_SEC || ageSec < -MAX_FUTURE_SKEW_SEC) {
    return json(401, { error: 'auth_date expired' }, cors);
  }

  if (!(await verifyTelegramSignature(data, botToken))) {
    return json(401, { error: 'invalid telegram signature' }, cors);
  }

  const telegramId = Number(data.id);
  const email = `tg-${telegramId}@telegram.local`;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const meta = {
    telegram_id: telegramId,
    telegram_username: data.username ?? null,
    first_name: data.first_name ?? null,
    last_name: data.last_name ?? null,
    photo_url: data.photo_url ?? null,
    provider: 'telegram',
  };
  const appMeta = { provider: 'telegram', providers: ['telegram'], telegram_id: telegramId };

  const found = await findUserByEmail(admin, email);
  if (!found.ok) {
    console.error('[telegram-auth] user lookup failed:', found.error);
    return json(500, { error: 'auth lookup failed' }, cors);
  }

  if (!found.user) {
    if (!(await isRegistrationOpen(admin))) return json(403, { error: 'registration_closed' }, cors);
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: meta,
      app_metadata: appMeta,
    });
    if (error || !created.user) {
      console.error('[telegram-auth] createUser failed:', error?.message ?? 'unknown');
      return json(500, { error: 'account creation failed' }, cors);
    }
  } else {
    // Guard от pre-hijack: telegram_id в app_metadata пишет только эта функция (service role).
    if (!found.user.app_metadata.telegram_id || Number(found.user.app_metadata.telegram_id) !== telegramId) {
      return json(409, { error: 'email conflict: account exists with different provider' }, cors);
    }
    const { error: updateErr } = await admin.auth.admin.updateUserById(found.user.id, {
      user_metadata: meta,
      app_metadata: appMeta,
    });
    if (updateErr) {
      console.error('[telegram-auth] updateUser failed:', updateErr.message);
      return json(500, { error: 'account update failed' }, cors);
    }
  }

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (linkErr || !link.properties) {
    console.error('[telegram-auth] generateLink failed:', linkErr?.message ?? 'unknown');
    return json(500, { error: 'login link generation failed' }, cors);
  }

  return json(200, { token_hash: link.properties.hashed_token, email }, cors);
});
