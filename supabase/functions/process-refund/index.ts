// supabase/functions/process-refund/index.ts
//
// Авторизованный endpoint: пользователь запрашивает возврат Pro-подписки.
// Условие: plan=pro, paid_at ≤ 14 дней назад, refunded_at IS NULL, op_key IS NOT NULL.
// Вызывает Robokassa Refund API (JWT + Password3), обновляет profiles и payments.
//
// Обязательные Secrets: ROBOKASSA_PASSWORD3, ROBOKASSA_TEST_PASSWORD3
// Автоматические: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

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

function base64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  const b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function buildJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header  = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body    = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const signing = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signing));
  return `${signing}.${base64url(sig)}`;
}

type RefundStatus = 'finished' | 'processing' | 'canceled';

async function pollStatus(requestId: string): Promise<RefundStatus> {
  const url = `https://services.robokassa.ru/RefundService/Refund/GetState?id=${encodeURIComponent(requestId)}`;
  for (let i = 0; i < 5; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 2000));
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json() as { label?: string };
      if (data.label === 'finished') return 'finished';
      if (data.label === 'canceled') return 'canceled';
    } catch (e) {
      console.warn('[process-refund] poll error:', e);
    }
  }
  return 'processing';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const isTestMode  = Deno.env.get('ROBOKASSA_IS_TEST') === 'true';
  const password3   = isTestMode
    ? Deno.env.get('ROBOKASSA_TEST_PASSWORD3')?.trim()
    : Deno.env.get('ROBOKASSA_PASSWORD3')?.trim();

  if (!supabaseUrl || !serviceKey || !password3) {
    console.error('[process-refund] missing env');
    return json(500, { error: 'server misconfigured' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json(401, { error: 'missing auth' });
  const token = authHeader.slice(7);

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: { user }, error: userError } = await db.auth.getUser(token);
  if (userError || !user) return json(401, { error: 'invalid token' });

  // Проверить текущий план — Lifetime не возвращается
  const { data: profile } = await db
    .from('profiles')
    .select('plan')
    .eq('user_id', user.id)
    .single();
  if (profile?.plan === 'lifetime') {
    return json(403, { error: 'lifetime_non_refundable' });
  }

  // Найти последний Pro-платёж в 14-дневном окне
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: payment, error: payErr } = await db
    .from('payments')
    .select('id, op_key, amount')
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
  if (!payment.op_key) return json(422, { error: 'op_key_missing' });

  // Построить JWT для Robokassa Refund API
  const jwtPayload = { OpKey: payment.op_key, RefundSum: Number(payment.amount) };
  const jwt = await buildJwt(jwtPayload, password3);

  // Вызвать Robokassa Refund API
  let requestId: string;
  try {
    const res = await fetch('https://services.robokassa.ru/RefundService/Refund/Create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jwt,
    });
    const data = await res.json() as { success?: boolean; message?: string; requestId?: string };
    if (!data.success || !data.requestId) {
      console.error('[process-refund] Robokassa rejected refund:', JSON.stringify(data));
      return json(502, { error: 'robokassa_error', message: data.message ?? 'rejected' });
    }
    requestId = data.requestId;
  } catch (e) {
    console.error('[process-refund] Robokassa fetch failed:', e);
    return json(502, { error: 'robokassa_unreachable' });
  }

  console.log(`[process-refund] requestId=${requestId} userId=${user.id} opKey=${payment.op_key}`);

  // Поллинг статуса — ждём до 10 сек
  const status = await pollStatus(requestId);
  if (status === 'canceled') {
    console.error('[process-refund] refund canceled by Robokassa, requestId:', requestId);
    return json(502, { error: 'refund_canceled' });
  }

  // finished или processing (таймаут) — оптимистично обновляем БД
  const now = new Date().toISOString();
  const [profileUpdate, paymentUpdate] = await Promise.all([
    db.from('profiles').update({ plan: 'free', plan_expires_at: null }).eq('user_id', user.id),
    db.from('payments').update({ refunded_at: now, refund_request_id: requestId }).eq('id', payment.id),
  ]);

  if (profileUpdate.error) console.error('[process-refund] profile update failed:', profileUpdate.error.message);
  if (paymentUpdate.error) console.error('[process-refund] payment update failed:', paymentUpdate.error.message);

  return json(200, { success: true, status });
});
