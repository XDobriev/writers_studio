// supabase/functions/payment-result2/index.ts
//
// DEPRECATED (22.06.2026). Push-механизм ResultUrl2 оказался ненадёжным
// (за всю историю ни разу не сохранил op_key). Получение OpKey переведено
// на pull через OpStateExt в robokassa-webhook (основной путь) и
// process-refund (fallback). Эта функция оставлена как безвредная заглушка
// на случай, если Robokassa всё же пришлёт уведомление; новые интеграции
// op_key на неё опираться не должны.
//
// Принимает JWS уведомление от Robokassa (ResultUrl2).
// Верифицирует RS256-подпись через jose (importSPKI + jwtVerify).
// Сохраняет OpKey и InvId в таблицу payments.
//
// Автоматические Supabase Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { importSPKI, jwtVerify } from 'https://esm.sh/jose@5.6.3';

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

let cachedPubKey: Awaited<ReturnType<typeof importSPKI>> | null = null;

async function getRobokassaKey() {
  if (cachedPubKey) return cachedPubKey;
  cachedPubKey = await importSPKI(ROBOKASSA_PEM, 'RS256');
  return cachedPubKey;
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

  let rawBody: string;
  try {
    rawBody = await req.text();
    if (!rawBody) throw new Error('empty body');
  } catch (e) {
    console.error('[payment-result2] cannot read body:', e);
    return new Response('bad body', { status: 400 });
  }

  const contentType = req.headers.get('content-type') ?? 'not set';
  console.log(`[payment-result2] content-type="${contentType}" body[0:300]="${rawBody.slice(0, 300)}"`);

  // Robokassa отправляет JWS base64-кодированным в теле запроса (подтверждено поддержкой 22.06.2026)
  let jws: string;
  try {
    jws = atob(rawBody.trim());
    console.log('[payment-result2] base64-decoded body, jws[0:100]:', jws.slice(0, 100));
  } catch {
    // Запасной вариант: raw JWS или form-urlencoded
    jws = rawBody.trim();
    if (!jws.includes('.') || jws.startsWith('jws=') || jws.startsWith('body=')) {
      const params = new URLSearchParams(jws);
      const candidate = params.get('jws') ?? params.get('body') ?? '';
      if (candidate) {
        console.log('[payment-result2] form-encoded body, extracted jws param');
        jws = candidate.trim();
      }
    }
  }

  let payload: Record<string, unknown>;
  try {
    const pubKey = await getRobokassaKey();
    const result = await jwtVerify(jws, pubKey, { algorithms: ['RS256'] });
    payload = result.payload as Record<string, unknown>;
  } catch (e) {
    console.error('[payment-result2] JWS verify failed:', e, '| jws[0:200]:', jws.slice(0, 200));
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

  // Retry loop — robokassa-webhook может ещё не завершить upsert к моменту вызова result2
  let existingPayment = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1000));
    const { data } = await db
      .from('payments')
      .select('inv_id')
      .eq('inv_id', invId)
      .maybeSingle();
    existingPayment = data;
    if (existingPayment) break;
    console.log(`[payment-result2] invId=${invId} not found yet, attempt ${attempt + 1}/5`);
  }
  if (!existingPayment) {
    console.warn(`[payment-result2] unknown invId=${invId} after 5 attempts, skipping op_key`);
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
