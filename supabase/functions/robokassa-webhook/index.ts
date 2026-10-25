// supabase/functions/robokassa-webhook/index.ts
//
// Robokassa Result URL (ResultUrl1). POST application/x-www-form-urlencoded.
// Подпись: MD5(OutSum:InvId:Password2:Shp_plan=…:Shp_user_id=…). Ответ при успехе — OK{InvId},
// иначе Робокасса повторяет (4 раза с интервалом 1 мин).
//
// Вся активация — одна SQL-транзакция public.activate_payment (20261022000200_billing_core):
// захват confirmed_at, слот Lifetime (при исчерпании всё равно выдаёт и пишет
// lifetime_oversold), профиль (checkout перезаписывает recurring_inv_id/plan_interval,
// recurring только продлевает; Lifetime не понижается), audit. Сбой → откат всего →
// 500 → Робокасса повторит. Повторная доставка → 'duplicate' → OK без мутаций.
// Дочерний платёж за уже оплаченный/закрытый период (поздний успех отклонённой попытки,
// L-8) → 'duplicate_period': подписка не меняется, ответ OK, в фоне — возврат по OpKey
// и сообщение владельцу (_shared/duplicateRefund.ts).
//
// Secrets: ROBOKASSA_PASSWORD2 (TEST_PASSWORD2 в тест-режиме), ROBOKASSA_MERCHANT_LOGIN,
// ROBOKASSA_PASSWORD3 (возврат дубля), GRANDFATHERING_ENDS_AT (необязателен). Деплой: --no-verify-jwt.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { md5hex, timingSafeEqual } from '../_shared/crypto.ts';
import { SYSTEM_ADMIN_ID, runInBackground, text } from '../_shared/http.ts';
import { isPaidPlan, minPrice } from '../_shared/pricing.ts';
import { fetchOpKey } from '../_shared/robokassa.ts';
import { createRefund, pollRefundState } from '../_shared/refund.ts';
import { refundDuplicatePayment } from '../_shared/duplicateRefund.ts';
import { notifyOwner } from '../_shared/telegram.ts';

// OutSum:InvId:Password2:Shp_param1=val1:… (Shp_* по алфавиту)
function buildSignatureString(outSum: string, invId: string, password2: string, shp: Record<string, string>): string {
  const shpParts = Object.entries(shp).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`);
  return [outSum, invId, password2, ...shpParts].join(':');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return text(405, 'method not allowed');

  const merchantLogin = Deno.env.get('ROBOKASSA_MERCHANT_LOGIN');
  const supabaseUrl   = Deno.env.get('SUPABASE_URL');
  const serviceKey    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    console.error('[robokassa-webhook] missing env');
    return text(200, 'ERROR: env not configured');
  }

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(await req.text());
  } catch {
    return text(200, 'ERROR: cannot read body');
  }

  const outSum         = params.get('OutSum') ?? '';
  const invId          = params.get('InvId') ?? '';
  const signatureValue = params.get('SignatureValue') ?? '';
  const shpPlan        = params.get('Shp_plan') ?? '';
  const shpUserId      = params.get('Shp_user_id') ?? '';

  // IsTest только из env: иначе атакующий подставил бы тестовый пароль.
  const isTest = Deno.env.get('ROBOKASSA_IS_TEST') === 'true';
  const password2 = (isTest ? Deno.env.get('ROBOKASSA_TEST_PASSWORD2') : Deno.env.get('ROBOKASSA_PASSWORD2'))?.trim();
  if (!password2) {
    console.error('[robokassa-webhook] missing password2 for isTest=' + isTest);
    return text(200, 'ERROR: env not configured');
  }

  if (!outSum || !invId || !signatureValue || !shpPlan || !shpUserId) {
    console.error('[robokassa-webhook] missing params', { invId, shpPlan });
    return text(200, 'ERROR: missing params');
  }

  const expectedSig = md5hex(buildSignatureString(outSum, invId, password2, { Shp_plan: shpPlan, Shp_user_id: shpUserId }));
  if (!timingSafeEqual(expectedSig.toLowerCase(), signatureValue.toLowerCase())) {
    // Ожидаемую подпись НЕ логируем: это валидная подпись для присланных параметров.
    console.error(`[robokassa-webhook] bad signature invId=${invId}`);
    return text(200, 'BAD SIGN');
  }

  if (!isPaidPlan(shpPlan)) {
    console.error('[robokassa-webhook] unknown plan:', shpPlan);
    return text(200, `ERROR: unknown plan`);
  }

  // Нижняя граница суммы (ранняя цена). В тест-режиме BILLING_TEST_AMOUNT легитимно ниже.
  if (!isTest) {
    const paid = parseFloat(outSum);
    if (Number.isNaN(paid) || paid + 0.01 < minPrice(shpPlan)) {
      console.error('[robokassa-webhook] OutSum below plan minimum, not activating', { shpPlan, paid, invId });
      return text(200, 'ERROR: amount below plan price');
    }
  }

  const grandfatheringEndsAt = Deno.env.get('GRANDFATHERING_ENDS_AT');
  const inWindow = grandfatheringEndsAt ? new Date() < new Date(grandfatheringEndsAt) : false;

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: result, error: activateErr } = await db.rpc('activate_payment', {
    p_inv_id: invId,
    p_user_id: shpUserId,
    p_plan: shpPlan,
    p_amount: parseFloat(outSum),
    p_grandfather: inWindow,
  });
  if (activateErr) {
    console.error(`[robokassa-webhook] activate_payment failed invId=${invId}:`, activateErr.message);
    return text(500, 'ERROR: activation failed');
  }

  const activation = (result ?? {}) as { status?: string; plan?: string; plan_expires_at?: string | null; source?: string; oversold?: boolean; reason?: string };
  if (activation.status === 'duplicate') {
    console.log(`[robokassa-webhook] duplicate delivery invId=${invId}, acking without mutation`);
    return text(200, `OK${invId}`);
  }
  if (activation.oversold) console.error(`[robokassa-webhook] lifetime oversold invId=${invId}`);
  if (activation.status === 'lifetime_kept') console.error(`[robokassa-webhook] pro payment on lifetime account invId=${invId} — needs manual refund`);

  // OpKey (нужен для возврата) — best-effort pull через OpStateExt.
  let opKey: string | null = null;
  if (merchantLogin) {
    opKey = await fetchOpKey(merchantLogin, invId, password2);
    if (opKey) {
      const { error } = await db.from('payments').update({ op_key: opKey }).eq('inv_id', invId);
      if (error) console.error('[robokassa-webhook] op_key update failed:', error.message);
    } else {
      console.warn(`[robokassa-webhook] OpKey not retrieved for invId=${invId} (process-refund will retry)`);
    }
  }

  if (activation.status === 'duplicate_period') {
    console.error(`[robokassa-webhook] recurring duplicate invId=${invId} reason=${activation.reason}, refunding`);
    const audit = async (action: string, payload: Record<string, unknown>) => {
      const { error } = await db.from('admin_audit_log').insert({
        admin_id: SYSTEM_ADMIN_ID, admin_email: 'system', action, target_user_id: shpUserId, payload,
      });
      if (error) console.error(`[robokassa-webhook] audit ${action} failed:`, error.message);
    };
    runInBackground(refundDuplicatePayment(
      { invId, userId: shpUserId, amount: outSum, reason: activation.reason ?? 'unknown', opKey },
      {
        password3: Deno.env.get('ROBOKASSA_PASSWORD3')?.trim() || null,
        claim: async () => {
          const { data, error } = await db.from('payments')
            .update({ refunded_at: new Date().toISOString() })
            .eq('inv_id', invId).is('refunded_at', null).select('id');
          if (error) console.error('[robokassa-webhook] duplicate refund claim failed:', error.message);
          return Boolean(data?.length);
        },
        release: async () => {
          const { error } = await db.from('payments').update({ refunded_at: null }).eq('inv_id', invId);
          if (error) console.error('[robokassa-webhook] duplicate refund claim rollback failed:', error.message);
        },
        saveRequestId: async (requestId) => {
          const { error } = await db.from('payments').update({ refund_request_id: requestId }).eq('inv_id', invId);
          if (error) console.error('[robokassa-webhook] refund_request_id save failed:', error.message);
        },
        audit,
        notify: notifyOwner,
        createRefund,
        pollState: pollRefundState,
      },
    ).then(
      (outcome) => console.log(`[robokassa-webhook] duplicate invId=${invId} refund outcome=${outcome}`),
      (e) => console.error(`[robokassa-webhook] duplicate invId=${invId} refund crashed:`, e instanceof Error ? e.message : String(e)),
    ));
    return text(200, `OK${invId}`);
  }

  // Письмо об успешной оплате — через payment-confirmation, в фоне.
  const { data: userData, error: userErr } = await db.auth.admin.getUserById(shpUserId);
  if (userErr) console.warn('[robokassa-webhook] getUserById failed:', userErr.message);
  const userEmail = userData?.user?.email ?? null;
  if (userEmail && activation.status === 'activated') {
    const { data: prof } = await db.from('profiles').select('recurring_inv_id').eq('user_id', shpUserId).maybeSingle();
    runInBackground(
      fetch(`${supabaseUrl}/functions/v1/payment-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({
          user_email: userEmail,
          transaction_id: invId,
          amount: outSum,
          plan: shpPlan === 'pro_annual' ? 'pro_yearly' : shpPlan === 'pro' ? 'pro_monthly' : 'lifetime',
          plan_expires_at: activation.plan_expires_at ?? undefined,
          auto_renew: Boolean(prof?.recurring_inv_id),
        }),
      }).then((r) => {
        if (!r.ok) console.warn('[robokassa-webhook] payment-confirmation status', r.status);
      }).catch((e) => console.warn('[robokassa-webhook] payment-confirmation error:', e instanceof Error ? e.message : String(e))),
    );
  }

  return text(200, `OK${invId}`);
});
