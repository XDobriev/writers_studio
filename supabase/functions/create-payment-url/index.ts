// supabase/functions/create-payment-url/index.ts
//
// Ссылка оплаты Робокассы. Body: { plan: 'pro'|'pro_annual'|'lifetime', consent?: boolean }.
//
// Серверные проверки (раньше были только в UI):
//   * feature flag payments_enabled = false → 503 payments_disabled;
//   * Lifetime у пользователя → 409 already_lifetime (Pro поверх Lifetime понизил бы его);
//   * активная автопродлеваемая Pro → 409 already_pro (отменённую/без мандата можно купить заново);
//   * Lifetime: слотов 0 → 409 lifetime_sold_out;
//   * Pro при включённых рекуррентах: без consent:true → 400 consent_required. Согласие пишется
//     здесь же в recurring_consents (service role): IP из x-forwarded-for, UA, версия и текст.
//     Не записалось — ссылка не выдаётся (без доказательства согласия Recurring не ставим).
// Счёт пред-создаётся в payments (source='checkout', recurring = был ли флаг Recurring) —
// вебхук по нему понимает, что это новый мандат, а не дочерний платёж.
//
// Ранняя цена: окно GRANDFATHERING_ENDS_AT для новых покупок, либо profiles.grandfathered
// у пользователя, чья Pro ещё числится (истекла, но в grace). После понижения флаг сброшен.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { md5hex } from '../_shared/crypto.ts';
import { bearer, clientIp, corsHeaders, json } from '../_shared/http.ts';
import { DESCRIPTIONS, RECURRING_CONSENT_VERSION, isPaidPlan, priceFor, recurringConsentText } from '../_shared/pricing.ts';
import { buildReceipt, newInvId } from '../_shared/robokassa.ts';

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' }, cors);

  const merchantLogin = Deno.env.get('ROBOKASSA_MERCHANT_LOGIN');
  const supabaseUrl   = Deno.env.get('SUPABASE_URL');
  const serviceKey    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const isTestMode    = Deno.env.get('ROBOKASSA_IS_TEST') === 'true';
  const password1     = isTestMode
    ? Deno.env.get('ROBOKASSA_TEST_PASSWORD1')?.trim()
    : Deno.env.get('ROBOKASSA_PASSWORD1')?.trim();

  if (!merchantLogin || !supabaseUrl || !serviceKey || !password1) {
    console.error('[create-payment-url] missing env');
    return json(500, { error: 'server misconfigured' }, cors);
  }

  const token = bearer(req);
  if (!token) return json(401, { error: 'missing auth' }, cors);

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: { user }, error: userError } = await db.auth.getUser(token);
  if (userError || !user) return json(401, { error: 'invalid token' }, cors);

  let plan: unknown;
  let consent = false;
  try {
    const body = await req.json();
    plan = body?.plan;
    consent = body?.consent === true;
  } catch {
    return json(400, { error: 'invalid body' }, cors);
  }
  if (!isPaidPlan(plan)) return json(400, { error: 'unknown plan' }, cors);

  const { data: flag, error: flagErr } = await db
    .from('feature_flags').select('enabled').eq('key', 'payments_enabled').maybeSingle();
  if (flagErr) {
    console.error('[create-payment-url] flag read failed:', flagErr.message);
    return json(500, { error: 'db error' }, cors);
  }
  if (flag && flag.enabled === false) return json(503, { error: 'payments_disabled' }, cors);

  const { data: profile, error: profileErr } = await db
    .from('profiles')
    .select('plan, plan_expires_at, grandfathered, recurring_inv_id, cancel_at_period_end')
    .eq('user_id', user.id)
    .single();
  if (profileErr || !profile) {
    console.error('[create-payment-url] profile read failed:', profileErr?.message ?? 'no row');
    return json(500, { error: 'db error' }, cors);
  }

  if (profile.plan === 'lifetime') return json(409, { error: 'already_lifetime' }, cors);

  const proActive = profile.plan === 'pro'
    && (profile.plan_expires_at === null || new Date(profile.plan_expires_at) > new Date());
  if (plan !== 'lifetime' && proActive && profile.recurring_inv_id && !profile.cancel_at_period_end) {
    return json(409, { error: 'already_pro' }, cors);
  }

  if (plan === 'lifetime') {
    const { data: slots, error: slotsErr } = await db
      .from('app_settings').select('value').eq('key', 'lifetime_slots_remaining').maybeSingle();
    if (slotsErr) return json(500, { error: 'db error' }, cors);
    const remaining = slots ? parseInt(slots.value, 10) : 0;
    if (!(remaining > 0)) return json(409, { error: 'lifetime_sold_out' }, cors);
  }

  const grandfatheringEndsAt = Deno.env.get('GRANDFATHERING_ENDS_AT');
  const inWindow = grandfatheringEndsAt ? new Date() < new Date(grandfatheringEndsAt) : false;
  const keepsEarlyPrice = profile.grandfathered === true && profile.plan === 'pro';
  const baseOutSum = priceFor(plan, inWindow || keepsEarlyPrice);
  // BILLING_TEST_AMOUNT — тест-override суммы. Только в тест-режиме.
  const outSum = isTestMode ? (Deno.env.get('BILLING_TEST_AMOUNT') ?? baseOutSum) : baseOutSum;

  const recurringEnabled = Deno.env.get('ROBOKASSA_RECURRING_ENABLED') === 'true';
  const isPro = plan === 'pro' || plan === 'pro_annual';
  if (isPro && recurringEnabled && !consent) {
    return json(400, { error: 'consent_required' }, cors);
  }
  const sendRecurring = isPro && recurringEnabled && consent;

  const invId     = newInvId();

  if (sendRecurring) {
    const { error: consentErr } = await db.from('recurring_consents').insert({
      user_id: user.id,
      plan,
      inv_id: invId,
      ip: clientIp(req),
      user_agent: req.headers.get('user-agent')?.slice(0, 512) ?? null,
      consent_version: RECURRING_CONSENT_VERSION,
      consent_text: recurringConsentText(plan === 'pro_annual' ? 'pro_annual' : 'pro'),
    });
    if (consentErr) {
      console.error('[create-payment-url] consent insert failed:', consentErr.message);
      return json(500, { error: 'consent_not_saved' }, cors);
    }
  }

  const { error: payErr } = await db.from('payments').insert({
    inv_id: invId,
    user_id: user.id,
    amount: parseFloat(outSum),
    plan,
    source: 'checkout',
    recurring: sendRecurring,
  });
  if (payErr) {
    console.error('[create-payment-url] payments pre-insert failed:', payErr.message);
    return json(500, { error: 'db error' }, cors);
  }

  const receipt = buildReceipt(DESCRIPTIONS[plan], outSum, user.email);
  // Подпись: MerchantLogin:OutSum:InvId:ReceiptJSON:Password1:Shp_plan=…:Shp_user_id=…
  // Receipt в подписи — raw JSON, в URL — encodeURIComponent (рабочая формула 17-18.06.2026).
  const sigString = `${merchantLogin}:${outSum}:${invId}:${receipt.json}:${password1}:Shp_plan=${plan}:Shp_user_id=${user.id}`;
  const signature = md5hex(sigString);

  const params = new URLSearchParams({
    MerchantLogin:  merchantLogin,
    OutSum:         outSum,
    InvId:          invId,
    Description:    DESCRIPTIONS[plan],
    SignatureValue: signature,
    IsTest:         isTestMode ? '1' : '0',
    Shp_plan:       plan,
    Shp_user_id:    user.id,
    ...(sendRecurring ? { Recurring: 'true' } : {}),
  });

  const url = `https://auth.robokassa.ru/Merchant/Index.aspx?${params.toString()}&Receipt=${receipt.encoded}`;
  console.log(`[create-payment-url] plan=${plan} invId=${invId} isTest=${isTestMode} recurring=${sendRecurring}`);
  return json(200, { url }, cors);
});
