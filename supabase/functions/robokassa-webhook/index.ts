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

  const isTest = params.get('IsTest') === '1';
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
      return text(500, 'ERROR: slot decrement failed');
    }
    if (!slotOk) {
      console.error('[robokassa-webhook] no lifetime slots remaining for user:', shpUserId);
      return text(500, 'ERROR: no lifetime slots');
    }

    const { error } = await db
      .from('profiles')
      .update({ plan: 'lifetime', plan_expires_at: null })
      .eq('user_id', shpUserId);
    if (error) {
      console.error('[robokassa-webhook] profiles update failed:', error.message);
      return text(500, 'ERROR: profiles update failed');
    }

  } else if (shpPlan === 'pro' || shpPlan === 'pro_annual') {
    const daysToAdd = shpPlan === 'pro_annual' ? 365 : 31;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + daysToAdd);

    const grandfatheringEndsAt = Deno.env.get('GRANDFATHERING_ENDS_AT');
    const isGrandfathering = grandfatheringEndsAt
      ? new Date() < new Date(grandfatheringEndsAt)
      : false;

    expiresAtIso = expiresAt.toISOString();
    const updateData: Record<string, unknown> = {
      plan: 'pro',
      plan_expires_at: expiresAtIso,
    };
    if (isGrandfathering) updateData.grandfathered = true;

    const { error } = await db
      .from('profiles')
      .update(updateData)
      .eq('user_id', shpUserId);
    if (error) {
      console.error('[robokassa-webhook] profiles update failed:', error.message);
      return text(500, 'ERROR: profiles update failed');
    }

  } else {
    console.error('[robokassa-webhook] unknown plan:', shpPlan);
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
