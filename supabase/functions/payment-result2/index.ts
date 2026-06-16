// supabase/functions/payment-result2/index.ts
//
// Принимает JWS уведомление от Robokassa (ResultUrl2).
// Верифицирует подпись публичным ключом Robokassa (RS256).
// Сохраняет OpKey и InvId в таблицу payments.
//
// Автоматические Supabase Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Публичный ключ Robokassa (SPKI/PEM, извлечён из https://docs.robokassa.ru/media/files/jwtsign.cer)
const ROBOKASSA_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA44EdooH8yufX8qMcXrdS
SKSNeKyuW+1smLOyo8k6/KKAqp0b7L+z6e9r0kIlTy+FQTD+ZaUIj6MPG8aRguVu
8joDpYWX33mJ6/RFSvUYKFIinKd7WZ4OokMJ2bFOE+2EvQGZS6NZxSRihMbp3BvA
mb/PwFYoV51vYgLIU0rVdPfcLc6SiOnyY22FYKaq+9r7KKWK5HilfVewbJiP2A9v
OqjhbBP1uArPET92j/pDyiWOsNevChwBMEx0ZHgWyEhSyRQA4Sq5usFbCikc3wmK
zDYrXRBTnVJ4ValUtSQj4Pxq+2XX46qm4AZUGHatHDf2UI73LZZ2ffeqLWW3Kaf5
sQIDAQAB
-----END PUBLIC KEY-----`;

let cachedPubKey: CryptoKey | null = null;

async function getRobokassaKey(): Promise<CryptoKey> {
  if (cachedPubKey) return cachedPubKey;
  const b64 = ROBOKASSA_PEM.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const binary = atob(b64);
  const spki = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) spki[i] = binary.charCodeAt(i);
  cachedPubKey = await crypto.subtle.importKey(
    'spki',
    spki.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  return cachedPubKey;
}

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
  const binary = atob(padded);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf;
}

async function verifyJws(jws: string): Promise<Record<string, unknown>> {
  const parts = jws.trim().split('.');
  if (parts.length !== 3) throw new Error(`invalid JWS: ${parts.length} parts`);
  const [headerB64, payloadB64, sigB64] = parts;

  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sig = b64urlToBytes(sigB64);

  const pubKey = await getRobokassaKey();
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', pubKey, sig, signingInput);
  if (!valid) throw new Error('JWS signature invalid');

  return JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64)));
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
    payload = await verifyJws(jws);
  } catch (e) {
    console.error('[payment-result2] JWS verify failed:', e, '| raw:', jws.slice(0, 200));
    return new Response('bad jws', { status: 400 });
  }

  const data   = payload['data'] as Record<string, unknown> | undefined;
  const opKey  = data?.['opKey']  as string | undefined;
  const invId  = data?.['invId']  as string | undefined;

  if (!opKey || !invId) {
    console.error('[payment-result2] missing opKey or invId in payload:', JSON.stringify(payload).slice(0, 300));
    return new Response('missing fields', { status: 200 });
  }

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: existingPayment } = await db
    .from('payments')
    .select('inv_id')
    .eq('inv_id', invId)
    .maybeSingle();
  if (!existingPayment) {
    console.warn(`[payment-result2] unknown invId=${invId}, skipping op_key`);
    return new Response('OK', { status: 200 });
  }

  const { error } = await db.from('payments').upsert(
    { inv_id: invId, op_key: opKey },
    { onConflict: 'inv_id' },
  );
  if (error) {
    console.error('[payment-result2] upsert failed:', error.message);
    return new Response('db error', { status: 500 });
  }

  console.log(`[payment-result2] verified & saved opKey for invId=${invId}`);
  return new Response('OK', { status: 200 });
});
