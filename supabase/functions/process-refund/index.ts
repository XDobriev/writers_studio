// supabase/functions/process-refund/index.ts
//
// Авторизованный endpoint: пользователь запрашивает возврат Pro-подписки.
// Условие: plan=pro, paid_at ≤ 14 дней назад, refunded_at IS NULL, op_key IS NOT NULL.
// Вызывает Robokassa Refund API: POST /RefundService/Refund/Create (JWT, подпись Password3).
// Статус поллится через GET /RefundService/Refund/GetState?id=<requestId>.
//
// Обязательные Secrets: ROBOKASSA_PASSWORD3
// Автоматические: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { Md5 } from 'https://esm.sh/ts-md5@1.3.1';

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

// Тянет OpKey через OpStateExt, если push на ResultUrl2 не сохранил его.
// Подпись: MD5(MerchantLogin:InvoiceID:Password2). OpKey может отсутствовать
// для некоторых методов оплаты — тогда вернётся null (op_key_missing).
async function fetchOpKey(login: string, invId: string, password2: string): Promise<string | null> {
  const sig = (Md5.hashStr(`${login}:${invId}:${password2}`) as string);
  const url =
    `https://auth.robokassa.ru/Merchant/WebService/Service.asmx/OpStateExt` +
    `?MerchantLogin=${encodeURIComponent(login)}&InvoiceID=${encodeURIComponent(invId)}&Signature=${sig}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const xml = await res.text();
    const m = xml.match(/<OpKey>([^<]+)<\/OpKey>/);
    return m ? m[1] : null;
  } catch (e) {
    console.warn('[process-refund] OpStateExt fetch error:', e);
    return null;
  }
}

function base64url(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function buildJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const header = base64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body   = base64url(enc.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${header}.${body}`));
  return `${header}.${body}.${base64url(new Uint8Array(sig))}`;
}

async function pollStatus(requestId: string): Promise<'finished' | 'canceled' | 'processing'> {
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const res = await fetch(
        `https://services.robokassa.ru/RefundService/Refund/GetState?id=${requestId}`,
      );
      if (res.ok) {
        const data = await res.json() as { label?: string };
        if (data.label === 'finished' || data.label === 'canceled') {
          return data.label as 'finished' | 'canceled';
        }
      }
    } catch { /* retry */ }
  }
  return 'processing';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  const supabaseUrl   = Deno.env.get('SUPABASE_URL');
  const serviceKey    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const password3     = Deno.env.get('ROBOKASSA_PASSWORD3')?.trim();
  // Для fallback-подтягивания OpKey через OpStateExt (если push не сохранил его)
  const merchantLogin = Deno.env.get('ROBOKASSA_MERCHANT_LOGIN');
  const isTest        = Deno.env.get('ROBOKASSA_IS_TEST') === 'true';
  const password2     = isTest
    ? Deno.env.get('ROBOKASSA_TEST_PASSWORD2')?.trim()
    : Deno.env.get('ROBOKASSA_PASSWORD2')?.trim();

  if (!supabaseUrl || !serviceKey || !password3) {
    console.error('[process-refund] missing env:', { supabaseUrl: !!supabaseUrl, serviceKey: !!serviceKey, password3: !!password3 });
    return json(500, { error: 'server misconfigured' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json(401, { error: 'missing auth' });
  const token = authHeader.slice(7);

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: { user }, error: userError } = await db.auth.getUser(token);
  if (userError || !user) return json(401, { error: 'invalid token' });

  // Lifetime не возвращается
  const { data: profile } = await db
    .from('profiles')
    .select('plan')
    .eq('user_id', user.id)
    .single();
  if (profile?.plan === 'lifetime') {
    return json(403, { error: 'lifetime_non_refundable' });
  }

  // Последний Pro-платёж в 14-дневном окне
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: payment, error: payErr } = await db
    .from('payments')
    .select('id, inv_id, op_key')
    .eq('user_id', user.id)
    .in('plan', ['pro', 'pro_annual'])
    .is('refunded_at', null)
    .gte('paid_at', cutoff)
    .order('paid_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (payErr) {
    console.error('[process-refund] payments query failed:', payErr.message);
    return json(500, { error: 'db error' });
  }
  if (!payment) return json(422, { error: 'refund_not_eligible' });

  // op_key мог не сохраниться через push ResultUrl2 — подтягиваем через OpStateExt.
  let opKey = payment.op_key as string | null;
  if (!opKey && merchantLogin && password2) {
    opKey = await fetchOpKey(merchantLogin, payment.inv_id, password2);
    if (opKey) {
      await db.from('payments').update({ op_key: opKey }).eq('id', payment.id);
    }
  }
  if (!opKey) return json(422, { error: 'op_key_missing' });

  // Robokassa Refund API — JWT подписан Password3
  let requestId: string;
  try {
    const jwt = await buildJwt(
      { OpKey: opKey },
      password3,
    );
    // Robokassa RefundService требует Content-Type: application/json, а JWT —
    // JSON-строкой в кавычках (ASP.NET [FromBody] string). Сырой JWT с text/plain → 415,
    // сырой JWT с application/json → 400 BadRequest. Проверено 22.06.2026.
    const res = await fetch('https://services.robokassa.ru/RefundService/Refund/Create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jwt),
    });
    const data = await res.json() as { success?: boolean; message?: string; requestId?: string };
    if (!data.success || !data.requestId) {
      console.error('[process-refund] Robokassa rejected:', JSON.stringify(data));
      return json(502, { error: 'robokassa_error', message: data.message ?? 'rejected' });
    }
    requestId = data.requestId;
  } catch (e) {
    console.error('[process-refund] Robokassa fetch failed:', e);
    return json(502, { error: 'robokassa_unreachable' });
  }

  const label = await pollStatus(requestId);
  if (label === 'canceled') {
    console.error(`[process-refund] refund canceled requestId=${requestId}`);
    return json(502, { error: 'refund_canceled' });
  }

  console.log(`[process-refund] refund ok userId=${user.id} opKey=${opKey} status=${label}`);

  const now = new Date().toISOString();
  const [profileUpdate, paymentUpdate] = await Promise.all([
    db.from('profiles').update({ plan: 'free', plan_expires_at: null }).eq('user_id', user.id),
    db.from('payments').update({ refunded_at: now, refund_request_id: requestId }).eq('id', payment.id),
  ]);

  if (profileUpdate.error) console.error('[process-refund] profile update failed:', profileUpdate.error.message);
  if (paymentUpdate.error) console.error('[process-refund] payment update failed:', paymentUpdate.error.message);

  return json(200, { success: true });
});
