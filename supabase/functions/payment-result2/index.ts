// supabase/functions/payment-result2/index.ts
//
// Принимает JWS уведомление от Robokassa (ResultUrl2).
// Извлекает OpKey и InvId, сохраняет в таблицу payments.
//
// Автоматические Supabase Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function b64urlDecode(s: string): string {
  // base64url → base64 → decode
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
  return atob(padded);
}

function parseJwsPayload(jws: string): Record<string, unknown> {
  const parts = jws.trim().split('.');
  if (parts.length !== 3) throw new Error(`invalid JWS: expected 3 parts, got ${parts.length}`);
  return JSON.parse(b64urlDecode(parts[1]));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    console.error('[payment-result2] missing env');
    return new Response('env error', { status: 500 });
  }

  let jws: string;
  try {
    jws = await req.text();
    if (!jws) throw new Error('empty body');
  } catch (e) {
    console.error('[payment-result2] cannot read body:', e);
    return new Response('bad body', { status: 400 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = parseJwsPayload(jws);
  } catch (e) {
    console.error('[payment-result2] JWS parse failed:', e, '| raw body:', jws.slice(0, 200));
    return new Response('bad jws', { status: 400 });
  }

  // Извлекаем опКей и invId из data-поля
  const data   = payload['data'] as Record<string, unknown> | undefined;
  const opKey  = data?.['opKey']  as string | undefined;
  const invId  = data?.['invId']  as string | undefined;

  if (!opKey || !invId) {
    console.error('[payment-result2] missing opKey or invId in payload:', JSON.stringify(payload).slice(0, 300));
    // Вернуть 200 чтобы Robokassa не повторяла: данных нет, повтор не поможет
    return new Response('missing fields', { status: 200 });
  }

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // UPSERT: если robokassa-webhook уже создал строку — обновляем op_key
  // если ещё нет — создаём с минимальными данными (user_id, amount, plan nullable/defaulted)
  const { error } = await db.from('payments').upsert(
    { inv_id: invId, op_key: opKey },
    { onConflict: 'inv_id' },
  );
  if (error) {
    console.error('[payment-result2] upsert failed:', error.message);
    // Вернуть 500 → Robokassa повторит запрос, это желательно
    return new Response('db error', { status: 500 });
  }

  console.log(`[payment-result2] saved opKey for invId=${invId}`);
  return new Response('OK', { status: 200 });
});
