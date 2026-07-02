// supabase/functions/robokassa-webhook/index.ts
//
// Robokassa Result URL webhook.
// Принимает POST application/x-www-form-urlencoded.
// Проверяет подпись: MD5(OutSum:InvId:Password2:Shp_plan=…:Shp_user_id=…)
// Обязательный ответ при успехе: строка OK{InvId} (иначе Robokassa повторяет запрос).
//
// Обязательные Supabase Secrets:
//   ROBOKASSA_PASSWORD2      — пароль #2 для проверки подписи вебхука
// Опциональные:
//   GRANDFATHERING_ENDS_AT   — ISO-дата окончания грандфазеринга (напр. '2026-09-01')
// Автоматические (Supabase предоставляет):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { Md5 } from 'https://esm.sh/ts-md5@1.3.1';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function text(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { ...CORS, 'Content-Type': 'text/plain' },
  });
}

function md5hex(input: string): string {
  return Md5.hashStr(input) as string;
}

// Тянет OpKey операции через OpStateExt — надёжная замена push'у ResultUrl2.
// Подпись: MD5(MerchantLogin:InvoiceID:Password2). OpKey может отсутствовать для
// некоторых методов оплаты (предположительно СБП/BNPL) — тогда вернётся null.
// best-effort с лёгким ретраем: операция может появиться в сервисе с задержкой.
async function fetchOpKey(login: string, invId: string, password2: string): Promise<string | null> {
  const sig = md5hex(`${login}:${invId}:${password2}`);
  const url =
    `https://auth.robokassa.ru/Merchant/WebService/Service.asmx/OpStateExt` +
    `?MerchantLogin=${encodeURIComponent(login)}&InvoiceID=${encodeURIComponent(invId)}&Signature=${sig}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1500));
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const xml = await res.text();
      const m = xml.match(/<OpKey>([^<]+)<\/OpKey>/);
      if (m) return m[1];
    } catch (e) {
      console.warn('[robokassa-webhook] OpStateExt fetch error:', e);
    }
  }
  return null;
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

// Строит строку подписи для Result URL:
// OutSum:InvId:Password2:Shp_param1=val1:Shp_param2=val2 (shp — по алфавиту)
function buildSignatureString(
  outSum: string,
  invId: string,
  password2: string,
  shpParams: Record<string, string>,
): string {
  const shpParts = Object.entries(shpParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  return [outSum, invId, password2, ...shpParts].join(':');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return text(405, 'method not allowed');

  const merchantLogin = Deno.env.get('ROBOKASSA_MERCHANT_LOGIN');
  const password2     = Deno.env.get('ROBOKASSA_PASSWORD2')?.trim();
  const testPassword2 = Deno.env.get('ROBOKASSA_TEST_PASSWORD2')?.trim();
  const supabaseUrl   = Deno.env.get('SUPABASE_URL');
  const serviceKey    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey) {
    console.error('[robokassa-webhook] missing env');
    return text(200, 'ERROR: env not configured');
  }

  let params: URLSearchParams;
  try {
    const bodyText = await req.text();
    params = new URLSearchParams(bodyText);
  } catch {
    return text(200, 'ERROR: cannot read body');
  }

  const outSum = params.get('OutSum') ?? '';
  const invId = params.get('InvId') ?? '';
  const signatureValue = params.get('SignatureValue') ?? '';
  const shpPlan = params.get('Shp_plan') ?? '';
  const shpUserId = params.get('Shp_user_id') ?? '';

  // IsTest определяется только из env, а не из тела запроса — иначе атакующий
  // может подставить тестовый пароль для тестовых транзакций в продакшн.
  const isTest = Deno.env.get('ROBOKASSA_IS_TEST') === 'true';
  const activePassword2 = isTest ? testPassword2 : password2;
  if (!activePassword2) {
    console.error('[robokassa-webhook] missing password2 for isTest=' + isTest);
    return text(200, 'ERROR: env not configured');
  }

  if (!outSum || !invId || !signatureValue || !shpPlan || !shpUserId) {
    console.error('[robokassa-webhook] missing params', { outSum, invId, shpPlan, shpUserId });
    return text(200, 'ERROR: missing params');
  }

  const sigString = buildSignatureString(outSum, invId, activePassword2, {
    Shp_plan: shpPlan,
    Shp_user_id: shpUserId,
  });
  const expectedSig = md5hex(sigString);
  if (!timingSafeEqual(expectedSig.toLowerCase(), signatureValue.toLowerCase())) {
    console.error('[robokassa-webhook] bad signature', { expected: expectedSig, got: signatureValue });
    return text(200, 'BAD SIGN');
  }

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Идемпотентность (баг #3): Robokassa повторяет ResultURL 4 раза/1 мин, если не получила
  // OK{InvId}. Без guard'а повтор после partial-success (профиль обновлён, но OK не вернулся)
  // стекал бы подписку и повторно дёргал decrement_lifetime_slot(). confirmed_at захватывается
  // атомарно: строку пред-создаёт scheduler (рекуррент) или мы сами (первый платёж), затем
  // один UPDATE ... WHERE confirmed_at IS NULL решает, кто из доставок обрабатывает платёж.
  const confirmedIso = new Date().toISOString();
  const { error: ensureErr } = await db.from('payments').upsert({
    inv_id:  invId,
    user_id: shpUserId,
    amount:  parseFloat(outSum),
    plan:    shpPlan,
    paid_at: confirmedIso,
  }, { onConflict: 'inv_id', ignoreDuplicates: true });
  if (ensureErr) {
    console.error('[robokassa-webhook] payments ensure failed:', ensureErr.message);
    return text(500, 'ERROR: payments ensure failed');
  }
  const { data: claimed, error: claimErr } = await db.from('payments')
    .update({ confirmed_at: confirmedIso })
    .eq('inv_id', invId)
    .is('confirmed_at', null)
    .select('inv_id');
  if (claimErr) {
    console.error('[robokassa-webhook] confirm claim failed:', claimErr.message);
    return text(500, 'ERROR: claim failed');
  }
  if (!claimed?.length) {
    console.log(`[robokassa-webhook] duplicate delivery invId=${invId}, acking without mutation`);
    return text(200, `OK${invId}`);
  }
  // Откат захвата при сбое мутации ниже — чтобы повтор Robokassa смог переобработать платёж.
  const releaseClaim = async () => {
    const { error } = await db.from('payments').update({ confirmed_at: null }).eq('inv_id', invId);
    if (error) console.error('[robokassa-webhook] claim rollback failed:', error.message);
  };

  let userEmail: string | null = null;
  try {
    const { data } = await db.auth.admin.getUserById(shpUserId);
    userEmail = data.user?.email ?? null;
  } catch (e) {
    console.warn('[robokassa-webhook] could not fetch user email:', e);
  }

  let expiresAtIso: string | undefined;

  if (shpPlan === 'lifetime') {
    const { data: slotOk, error: slotErr } = await db.rpc('decrement_lifetime_slot');
    if (slotErr) {
      console.error('[robokassa-webhook] slot decrement failed:', slotErr.message);
      await releaseClaim();
      return text(500, 'ERROR: slot decrement failed');
    }
    if (!slotOk) {
      console.error('[robokassa-webhook] no lifetime slots remaining for user:', shpUserId);
      await releaseClaim();
      return text(500, 'ERROR: no lifetime slots');
    }

    const { data: updatedLifetime, error } = await db
      .from('profiles')
      .update({ plan: 'lifetime', plan_expires_at: null })
      .eq('user_id', shpUserId)
      .select('user_id');
    if (error || !updatedLifetime?.length) {
      console.error('[robokassa-webhook] profiles update failed (lifetime):', error?.message ?? '0 rows', 'user:', shpUserId);
      await releaseClaim();
      return text(500, 'ERROR: profiles update failed');
    }

  } else if (shpPlan === 'pro' || shpPlan === 'pro_annual') {
    const daysToAdd = shpPlan === 'pro_annual' ? 365 : 31;

    // Продлеваем от текущей даты окончания если подписка ещё активна
    const { data: existing } = await db
      .from('profiles')
      .select('plan_expires_at, recurring_inv_id')
      .eq('user_id', shpUserId)
      .single();
    const now = new Date();
    const currentExpiry = existing?.plan_expires_at ? new Date(existing.plan_expires_at) : null;
    const baseDate = (currentExpiry && currentExpiry > now) ? currentExpiry : now;
    const expiresAt = new Date(baseDate);
    expiresAt.setDate(expiresAt.getDate() + daysToAdd);

    const grandfatheringEndsAt = Deno.env.get('GRANDFATHERING_ENDS_AT');
    const isGrandfathering = grandfatheringEndsAt
      ? new Date() < new Date(grandfatheringEndsAt)
      : false;

    expiresAtIso = expiresAt.toISOString();
    const updateData: Record<string, unknown> = {
      plan: 'pro',
      plan_expires_at: expiresAtIso,
      cancel_at_period_end: false,
    };
    if (isGrandfathering) updateData.grandfathered = true;
    // Первый платёж — сохраняем InvId как материнский для цепочки рекуррентов.
    // PreviousInvoiceID всегда = первый InvId (подтверждено поддержкой Robokassa).
    if (!existing?.recurring_inv_id) {
      updateData.recurring_inv_id = invId;
      updateData.plan_interval = shpPlan === 'pro_annual' ? 'annual' : 'monthly';
    }

    const { data: updatedPro, error } = await db
      .from('profiles')
      .update(updateData)
      .eq('user_id', shpUserId)
      .select('user_id');
    if (error || !updatedPro?.length) {
      console.error('[robokassa-webhook] profiles update failed (pro):', error?.message ?? '0 rows', 'user:', shpUserId);
      await releaseClaim();
      return text(500, 'ERROR: profiles update failed');
    }

  } else {
    console.error('[robokassa-webhook] unknown plan:', shpPlan);
    await releaseClaim();
    return text(200, `ERROR: unknown plan ${shpPlan}`);
  }

  const { error: auditErr } = await db.from('admin_audit_log').insert({
    admin_id: '00000000-0000-0000-0000-000000000000',
    admin_email: 'system',
    action: 'payment_received',
    target_user_id: shpUserId,
    payload: {
      amount: outSum,
      plan: shpPlan,
      inv_id: invId,
      provider: 'robokassa',
    },
  });
  if (auditErr) console.error('[robokassa-webhook] audit log failed:', auditErr.message);

  // OpKey тянем через OpStateExt (надёжный pull вместо хрупкого push на ResultUrl2).
  // best-effort: при неудаче op_key останется null, process-refund подтянет его позже.
  let opKey: string | null = null;
  if (merchantLogin) {
    opKey = await fetchOpKey(merchantLogin, invId, activePassword2);
    if (!opKey) console.warn(`[robokassa-webhook] OpKey not retrieved for invId=${invId} (will retry in process-refund)`);
  } else {
    console.warn('[robokassa-webhook] ROBOKASSA_MERCHANT_LOGIN not set — skipping OpKey fetch');
  }

  // Строка уже создана и захвачена (confirmed_at) в начале обработки — обновляем
  // авторитетные plan/amount (важно для pro_annual: scheduler пред-создаёт с plan='pro') и op_key.
  const { error: paymentErr } = await db.from('payments').update({
    amount: parseFloat(outSum),
    plan:   shpPlan,
    ...(opKey ? { op_key: opKey } : {}),
  }).eq('inv_id', invId);
  if (paymentErr) console.error('[robokassa-webhook] payments update failed:', paymentErr.message);

  if (userEmail) {
    const confirmationUrl = `${supabaseUrl}/functions/v1/payment-confirmation`;
    fetch(confirmationUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        user_email: userEmail,
        transaction_id: invId,
        amount: outSum,
        plan: shpPlan === 'pro_annual' ? 'pro_yearly' : shpPlan === 'pro' ? 'pro_monthly' : 'lifetime',
        ...(shpPlan !== 'lifetime' && {
          plan_expires_at: expiresAtIso,
        }),
      }),
    }).catch((e) => console.warn('[robokassa-webhook] payment-confirmation error:', e));
  }

  return text(200, `OK${invId}`);
});
