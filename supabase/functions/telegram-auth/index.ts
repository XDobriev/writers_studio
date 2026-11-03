// Telegram Login Widget callback.
// Принимает auth_data от https://telegram.org/js/telegram-widget.js, валидирует HMAC-подпись
// по схеме https://core.telegram.org/widgets/login#checking-authorization, создаёт/находит
// пользователя в Supabase и возвращает одноразовый token_hash для verifyOtp на фронте.
//
// Защита: hash сравнивается за постоянное время; auth_date не старше 15 минут и не из
// будущего (допуск 60 с); новые аккаунты не создаются при registration_open = false;
// поиск существующего пользователя — RPC find_auth_user_by_email (без лимита 1000).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { isTelegramAuthData, isTelegramAuthDateValid, verifyTelegramSignature } from '../_shared/telegramAuth.ts';
import { corsHeaders, json } from '../_shared/http.ts';
import { findUserByEmail, isEmailSquatter, isRegistrationOpen, releaseSquattedEmail } from '../_shared/authUsers.ts';

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

  let data: unknown;
  try {
    data = await req.json();
  } catch {
    return json(400, { error: 'invalid json' }, cors);
  }

  if (!isTelegramAuthData(data)) {
    return json(400, { error: 'missing required fields' }, cors);
  }

  if (!isTelegramAuthDateValid(data)) {
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

  let existing = found.user;
  if (existing && isEmailSquatter(existing.app_metadata)) {
    const released = await releaseSquattedEmail(admin, existing.id);
    if (!released.ok) {
      console.error('[telegram-auth] release squatted email failed:', released.error);
      return json(500, { error: 'account creation failed' }, cors);
    }
    existing = null;
  }

  if (!existing) {
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
    if (Number(existing.app_metadata.telegram_id) !== telegramId) {
      return json(409, { error: 'email conflict: account exists with different provider' }, cors);
    }
    const { error: updateErr } = await admin.auth.admin.updateUserById(existing.id, {
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
