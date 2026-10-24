// supabase/functions/process-refund/index.ts
//
// Возврат последнего Pro-платежа пользователя (14 дней). Bearer пользователя, verify_jwt: true.
//   * только подтверждённые платежи (confirmed_at IS NOT NULL) — пред-созданные
//     pending-строки scheduler'а / create-payment-url не выбираются;
//   * claim-first refunded_at до вызова Робокассы (двойной возврат невозможен);
//   * после одобрения — public.apply_refund: снимается ровно оплаченный этим платежом
//     период (если оплачен и следующий — Pro остаётся до новой даты), рекуррент
//     закрывается (recurring_inv_id = NULL), ранняя цена сгорает.
//   * повтор по уже возвращённому OpKey (ответ первой попытки потерялся) Робокасса отклоняет
//     с NotEnoughOperationFunds: claim остаётся, автопродление выключается
//     (cancel_at_period_end — обратимо, мандат не стирается), план не трогаем — деньги
//     могли и не вернуться; audit refund_needs_review, сверяет админ;
//   * статус 'processing' после 20 с поллинга считается успехом (Робокасса приняла заявку);
//     отмену такой заявки позже нужно сверять вручную (см. отчёт).
//
// Secrets: ROBOKASSA_PASSWORD3, ROBOKASSA_MERCHANT_LOGIN, ROBOKASSA_PASSWORD2 (fallback OpKey).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { SYSTEM_ADMIN_ID, bearer, corsHeaders, json } from '../_shared/http.ts';
import { classifyRefundCreate, fetchOpKey } from '../_shared/robokassa.ts';

function base64url(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function buildJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const header = base64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body   = base64url(enc.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${header}.${body}`));
  return `${header}.${body}.${base64url(new Uint8Array(sig))}`;
}

async function pollStatus(requestId: string): Promise<'finished' | 'canceled' | 'processing'> {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const res = await fetch(`https://services.robokassa.ru/RefundService/Refund/GetState?id=${encodeURIComponent(requestId)}`);
      if (res.ok) {
        const data = await res.json() as { label?: string };
        if (data.label === 'finished' || data.label === 'canceled') return data.label;
      }
    } catch { /* retry */ }
  }
  return 'processing';
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' }, cors);

  const supabaseUrl   = Deno.env.get('SUPABASE_URL');
  const serviceKey    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const password3     = Deno.env.get('ROBOKASSA_PASSWORD3')?.trim();
  const merchantLogin = Deno.env.get('ROBOKASSA_MERCHANT_LOGIN');
  const isTest        = Deno.env.get('ROBOKASSA_IS_TEST') === 'true';
  const password2     = (isTest ? Deno.env.get('ROBOKASSA_TEST_PASSWORD2') : Deno.env.get('ROBOKASSA_PASSWORD2'))?.trim();

  if (!supabaseUrl || !serviceKey || !password3) {
    console.error('[process-refund] missing env');
    return json(500, { error: 'server misconfigured' }, cors);
  }

  const token = bearer(req);
  if (!token) return json(401, { error: 'missing auth' }, cors);

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: { user }, error: userError } = await db.auth.getUser(token);
  if (userError || !user) return json(401, { error: 'invalid token' }, cors);

  const { data: profile, error: profileErr } = await db.from('profiles').select('plan').eq('user_id', user.id).single();
  if (profileErr) return json(500, { error: 'db error' }, cors);
  if (profile?.plan === 'lifetime') return json(403, { error: 'lifetime_non_refundable' }, cors);

  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: payment, error: payErr } = await db
    .from('payments')
    .select('id, inv_id, op_key')
    .eq('user_id', user.id)
    .in('plan', ['pro', 'pro_annual'])
    .not('confirmed_at', 'is', null)
    .is('refunded_at', null)
    .gte('confirmed_at', cutoff)
    .order('confirmed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (payErr) {
    console.error('[process-refund] payments query failed:', payErr.message);
    return json(500, { error: 'db error' }, cors);
  }
  if (!payment) return json(422, { error: 'refund_not_eligible' }, cors);

  let opKey = payment.op_key as string | null;
  if (!opKey && merchantLogin && password2) {
    opKey = await fetchOpKey(merchantLogin, payment.inv_id, password2, 1);
    if (opKey) {
      const { error } = await db.from('payments').update({ op_key: opKey }).eq('id', payment.id);
      if (error) console.error('[process-refund] op_key save failed:', error.message);
    }
  }
  if (!opKey) return json(422, { error: 'op_key_missing' }, cors);

  const { data: claimedRefund, error: claimErr } = await db.from('payments')
    .update({ refunded_at: new Date().toISOString() })
    .eq('id', payment.id)
    .is('refunded_at', null)
    .select('id');
  if (claimErr) {
    console.error('[process-refund] refund claim failed:', claimErr.message);
    return json(500, { error: 'db error' }, cors);
  }
  if (!claimedRefund?.length) return json(409, { error: 'refund_already_processing' }, cors);

  const releaseRefundClaim = async () => {
    const { error } = await db.from('payments').update({ refunded_at: null }).eq('id', payment.id);
    if (error) console.error('[process-refund] refund claim rollback failed:', error.message);
  };

  let requestId: string;
  try {
    const jwt = await buildJwt({ OpKey: opKey }, password3);
    // Content-Type: application/json, тело — JWT JSON-строкой (проверено 22.06.2026).
    const res = await fetch('https://services.robokassa.ru/RefundService/Refund/Create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jwt),
    });
    const data = await res.json() as { success?: boolean; message?: string; requestId?: string | null };
    const result = classifyRefundCreate(data);
    if (result.kind === 'already_created') {
      console.error(`[process-refund] refund already created inv=${payment.inv_id}, needs review`);
      const { error: stopErr } = await db.from('profiles')
        .update({ cancel_at_period_end: true })
        .eq('user_id', user.id);
      if (stopErr) console.error('[process-refund] stop renewal failed:', stopErr.message);
      const { error: auditErr } = await db.from('admin_audit_log').insert({
        admin_id: SYSTEM_ADMIN_ID,
        admin_email: 'system',
        action: 'refund_needs_review',
        target_user_id: user.id,
        payload: { inv_id: payment.inv_id, reason: 'NotEnoughOperationFunds', renewal_stopped: !stopErr },
      });
      if (auditErr) console.error('[process-refund] audit failed:', auditErr.message);
      return json(409, { error: 'refund_already_created' }, cors);
    }
    if (result.kind === 'rejected') {
      console.error('[process-refund] Robokassa rejected:', result.message, res.status);
      await releaseRefundClaim();
      return json(502, { error: 'robokassa_error' }, cors);
    }
    requestId = result.requestId;
  } catch (e) {
    console.error('[process-refund] Robokassa fetch failed:', e instanceof Error ? e.message : String(e));
    await releaseRefundClaim();
    return json(502, { error: 'robokassa_unreachable' }, cors);
  }

  const label = await pollStatus(requestId);
  if (label === 'canceled') {
    console.error(`[process-refund] refund canceled requestId=${requestId}`);
    await releaseRefundClaim();
    return json(502, { error: 'refund_canceled' }, cors);
  }

  const { data: applied, error: applyErr } = await db.rpc('apply_refund', { p_payment_id: payment.id, p_request_id: requestId });
  if (applyErr) {
    // Деньги уже возвращаются — claim не откатываем, профиль поправит админ.
    console.error(`[process-refund] apply_refund failed requestId=${requestId}:`, applyErr.message);
    return json(200, { success: true, status: label, profile_updated: false }, cors);
  }

  console.log(`[process-refund] refund ok inv=${payment.inv_id} status=${label}`);
  return json(200, { success: true, status: label, ...(applied ?? {}) }, cors);
});
