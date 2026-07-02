// supabase/functions/billing-scheduler/index.ts
//
// Ежедневный планировщик рекуррентных платежей.
// Вызывается pg_cron каждый день в 06:00 UTC.
// Находит Pro-пользователей с plan_expires_at <= now() + 3 дня,
// инициирует повторное списание через Robokassa Recurring API.
//
// Подпись child-платежа: MD5(MerchantLogin:OutSum:InvId:Password1)
// PreviousInvoiceID в подпись НЕ входит (по документации Robokassa).
//
// Secrets:
//   ROBOKASSA_MERCHANT_LOGIN, ROBOKASSA_PASSWORD1, ROBOKASSA_IS_TEST,
//   ROBOKASSA_TEST_PASSWORD1 (для тест-режима)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { Md5 } from 'https://esm.sh/ts-md5@1.3.1';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PRICES = {
  monthly: { base: '399.00', grandfathered: '290.00' },
  annual:  { base: '3490.00', grandfathered: '2900.00' },
};
const DESCRIPTIONS: Record<string, string> = {
  monthly: 'Подписка Pro — Авторская студия',
  annual:  'Подписка Pro (год) — Авторская студия',
};
const RECURRING_URL = 'https://auth.robokassa.ru/Merchant/Recurring';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function md5hex(input: string): string {
  return Md5.hashStr(input) as string;
}

// Constant-time сравнение для секрета планировщика (без тайминг-сайдканала).
function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

type Profile = {
  user_id: string;
  plan_expires_at: string;
  recurring_inv_id: string;
  grandfathered: boolean;
  plan_interval: 'monthly' | 'annual';
  last_billed_expiry: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  const merchantLogin    = Deno.env.get('ROBOKASSA_MERCHANT_LOGIN');
  const supabaseUrl      = Deno.env.get('SUPABASE_URL');
  const serviceKey       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const schedulerSecret  = Deno.env.get('SCHEDULER_SECRET');
  const isTestMode       = Deno.env.get('ROBOKASSA_IS_TEST') === 'true';
  const password1        = isTestMode
    ? Deno.env.get('ROBOKASSA_TEST_PASSWORD1')?.trim()
    : Deno.env.get('ROBOKASSA_PASSWORD1')?.trim();

  if (!merchantLogin || !supabaseUrl || !serviceKey || !password1 || !schedulerSecret) {
    console.error('[billing-scheduler] missing env');
    return json(500, { error: 'server misconfigured' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ') || !timingSafeEqual(authHeader.slice(7), schedulerSecret)) {
    return json(401, { error: 'unauthorized' });
  }

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: flagRow } = await db
    .from('feature_flags')
    .select('enabled')
    .eq('key', 'recurring_billing_enabled')
    .maybeSingle();
  if (!flagRow?.enabled) {
    console.log('[billing-scheduler] recurring_billing_enabled=false, skipping');
    return json(200, { skipped: true, reason: 'recurring_billing_enabled flag is off' });
  }

  // Находим Pro-пользователей, у которых подписка истекает в течение 3 дней,
  // не отменена и есть сохранённый recurring_inv_id для повторного списания
  const renewalCutoff = new Date();
  renewalCutoff.setDate(renewalCutoff.getDate() + 3);

  const { data: profiles, error: fetchErr } = await db
    .from('profiles')
    .select('user_id, plan_expires_at, recurring_inv_id, grandfathered, plan_interval, last_billed_expiry')
    .eq('plan', 'pro')
    .eq('cancel_at_period_end', false)
    .not('recurring_inv_id', 'is', null)
    .lte('plan_expires_at', renewalCutoff.toISOString());

  if (fetchErr) {
    console.error('[billing-scheduler] fetch profiles failed:', fetchErr.message);
    return json(500, { error: 'db error' });
  }

  const rows = (profiles ?? []) as Profile[];
  console.log(`[billing-scheduler] found ${rows.length} profiles for renewal`);

  const results: { user_id: string; inv_id?: string; error?: string }[] = [];

  for (const profile of rows) {
    // Идемпотентность цикла: если за этот же plan_expires_at списание уже инициировано
    // (получен OK от Robokassa) — не дёргать Recurring повторно. Ответ OK означает лишь
    // создание операции; продление plan_expires_at делает асинхронный webhook, поэтому до
    // его прихода юзер остаётся в выборке и без этого guard'а списался бы каждый прогон.
    if (profile.last_billed_expiry && profile.last_billed_expiry === profile.plan_expires_at) {
      console.log(`[billing-scheduler] skip ${profile.user_id}: already billed for cycle ${profile.plan_expires_at}`);
      continue;
    }

    const interval    = profile.plan_interval ?? 'monthly';
    // BILLING_TEST_AMOUNT — тест-override суммы (напр. 1₽ для E2E). Установить Secret → удалить после теста.
    const outSum      = Deno.env.get('BILLING_TEST_AMOUNT')
      ?? (profile.grandfathered ? PRICES[interval].grandfathered : PRICES[interval].base);
    const description = DESCRIPTIONS[interval];
    const shpPlan     = interval === 'annual' ? 'pro_annual' : 'pro';
    const newInvId    = String(Date.now()) + Math.floor(Math.random() * 1000);

    // Получаем email для чека (ФЗ-54 / РобоЧеки СМЗ)
    const { data: { user: authUser } } = await db.auth.admin.getUserById(profile.user_id);
    const userEmail = authUser?.email;

    const receiptObj: Record<string, unknown> = {
      items: [{
        name:            description,
        quantity:        1,
        sum:             parseFloat(outSum),
        payment_method:  'full_payment',
        payment_object:  'service',
        tax:             'none',
      }],
    };
    if (userEmail) receiptObj['email'] = userEmail;
    const receiptJson    = JSON.stringify(receiptObj);
    const receiptEncoded = encodeURIComponent(receiptJson);

    // Подпись дочернего платежа: MerchantLogin:OutSum:InvId:Receipt(raw JSON):Password1:Shp_plan=...:Shp_user_id=...
    // Receipt в подписи — raw minimized JSON (не URL-encoded) — docs.robokassa.ru/ru/pay-interface
    // PreviousInvoiceID в подпись НЕ входит — docs.robokassa.ru/ru/recurring-payments
    // Shp_* — алфавитный порядок: Shp_plan < Shp_user_id
    const sigString = `${merchantLogin}:${outSum}:${newInvId}:${receiptJson}:${password1}:Shp_plan=${shpPlan}:Shp_user_id=${profile.user_id}`;
    const signature = md5hex(sigString);

    const body = new URLSearchParams({
      MerchantLogin:     merchantLogin,
      InvId:             newInvId,
      OutSum:            outSum,
      Description:       description,
      PreviousInvoiceID: profile.recurring_inv_id,
      SignatureValue:    signature,
      IsTest:            isTestMode ? '1' : '0',
      Shp_plan:          shpPlan,
      Shp_user_id:       profile.user_id,
    });
    // Receipt добавляем вручную — encodeURIComponent, без двойного кодирования URLSearchParams
    const bodyStr = `${body.toString()}&Receipt=${receiptEncoded}`;

    try {
      const resp = await fetch(RECURRING_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyStr,
      });
      const respText = await resp.text();
      console.log(`[billing-scheduler] recurring for ${profile.user_id}: ${respText}`);

      if (!resp.ok || !respText.startsWith('OK')) {
        results.push({ user_id: profile.user_id, error: respText });
        await db.from('admin_audit_log').insert({
          admin_id:       '00000000-0000-0000-0000-000000000000',
          admin_email:    'system',
          action:         'recurring_charge_failed',
          target_user_id: profile.user_id,
          payload:        { inv_id: newInvId, response: respText },
        });
        continue;
      }

      // Фиксируем цикл сразу после OK (операция создана) — до подтверждения webhook'ом.
      // Так следующий суточный прогон не спишет повторно, пока webhook не продлит
      // plan_expires_at. При non-OK маркер не ставится → прогон повторит попытку.
      await db.from('profiles')
        .update({ last_billed_expiry: profile.plan_expires_at })
        .eq('user_id', profile.user_id);

      // Логируем попытку в payments (pending — webhook подтвердит)
      await db.from('payments').upsert({
        inv_id:  newInvId,
        user_id: profile.user_id,
        amount:  parseFloat(outSum),
        plan:    'pro',
        paid_at: new Date().toISOString(),
      }, { onConflict: 'inv_id', ignoreDuplicates: true });

      await db.from('admin_audit_log').insert({
        admin_id:       '00000000-0000-0000-0000-000000000000',
        admin_email:    'system',
        action:         'recurring_charge_initiated',
        target_user_id: profile.user_id,
        payload:        { inv_id: newInvId, amount: outSum, previous_inv_id: profile.recurring_inv_id, has_receipt: true, plan_interval: interval },
      });

      results.push({ user_id: profile.user_id, inv_id: newInvId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[billing-scheduler] fetch error for', profile.user_id, msg);
      results.push({ user_id: profile.user_id, error: msg });
    }
  }

  // Даунгрейд истёкших отменённых планов:
  // Pro-пользователи с cancel_at_period_end=true у которых plan_expires_at уже прошёл.
  const { data: expiredCancelled, error: expiredErr } = await db
    .from('profiles')
    .select('user_id, plan_expires_at')
    .eq('plan', 'pro')
    .eq('cancel_at_period_end', true)
    .lt('plan_expires_at', new Date().toISOString());

  if (expiredErr) {
    console.error('[billing-scheduler] expired-cancelled query failed:', expiredErr.message);
  } else {
    const expired = expiredCancelled ?? [];
    console.log(`[billing-scheduler] expiring ${expired.length} cancelled plans`);
    for (const p of expired) {
      const { error: downgradeErr } = await db
        .from('profiles')
        .update({ plan: 'free', plan_expires_at: null, cancel_at_period_end: false })
        .eq('user_id', p.user_id);
      if (downgradeErr) {
        console.error(`[billing-scheduler] downgrade failed for ${p.user_id}:`, downgradeErr.message);
        continue;
      }
      await db.from('admin_audit_log').insert({
        admin_id:       '00000000-0000-0000-0000-000000000000',
        admin_email:    'system',
        action:         'subscription_expired',
        target_user_id: p.user_id,
        payload:        { plan_expires_at: p.plan_expires_at },
      });
      console.log(`[billing-scheduler] downgraded userId=${p.user_id} (cancelled plan expired)`);
    }
  }

  return json(200, { processed: rows.length, results });
});
