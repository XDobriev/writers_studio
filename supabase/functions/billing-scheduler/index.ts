// supabase/functions/billing-scheduler/index.ts
//
// Ежедневный биллинг. Запуск: pg_cron 06:00 UTC (20261022000900_cron_billing_retention.sql),
// резерв — ручной GitHub workflow. Bearer = SCHEDULER_SECRET. Деплой: --no-verify-jwt.
//
// Порядок прогона:
//   1. Понижение истёкших (downgrade_expired_subscriptions) — ВСЕГДА, независимо от флага
//      recurring_billing_enabled и от cancel_at_period_end: отменённые — сразу по истечении,
//      неоплаченные — после 3 дней grace.
//   2. Если recurring_billing_enabled выключен — дальше не идём.
//   3. Напоминания за 1–3 дня до списания (get_renewal_reminders_due → claim → письмо).
//   4. Списания в день окончания периода и повторы (get_billing_due): до 4 попыток, раз в сутки.
//      Перед повтором спрашиваем у Робокассы статус прошлого дочернего счёта (OpStateExt):
//      оплачен/в обработке — не списываем повторно. Затем атомарный захват попытки
//      (claim_billing_attempt) ДО вызова Recurring — параллельный прогон получит NULL.
//      Строка payments (source='recurring') создаётся до вызова Recurring, ошибки
//      всех insert/update проверяются. for_expiry — продлеваемый plan_expires_at: если
//      банк позже дошлёт успех по уже отклонённой попытке, activate_payment распознает
//      дубль периода (L-8). OpStateExt здесь видит только последний счёт — поздний успех
//      более ранней попытки ловит webhook, а не scheduler.
//
// Ответ содержит только счётчики (без user_id и ответов Робокассы).
//
// Подпись child-платежа: MerchantLogin:OutSum:InvId:Receipt(raw JSON):Password1:Shp_plan=…:Shp_user_id=…
// PreviousInvoiceID в подпись не входит.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { escapeHtml, md5hex, timingSafeEqual } from '../_shared/crypto.ts';
import { SYSTEM_ADMIN_ID, bearer, json } from '../_shared/http.ts';
import { isDeliverableEmail, sendEmail } from '../_shared/email.ts';
import { DESCRIPTIONS, planForInterval, priceFor, type BillingInterval } from '../_shared/pricing.ts';
import { buildReceipt, fetchOpState, newInvId } from '../_shared/robokassa.ts';
import { retryDecision } from '../_shared/billingRetry.ts';

const RECURRING_URL = 'https://auth.robokassa.ru/Merchant/Recurring';
const MAX_ATTEMPTS = 4;

type DueRow = {
  user_id: string;
  email: string | null;
  plan_expires_at: string;
  recurring_inv_id: string;
  grandfathered: boolean;
  plan_interval: BillingInterval;
  is_retry: boolean;
  billing_attempts: number;
  pending_inv_id: string | null;
};

type ReminderRow = {
  user_id: string;
  email: string;
  plan_expires_at: string;
  plan_interval: BillingInterval;
  grandfathered: boolean;
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' });
}

function reminderEmail(r: ReminderRow): { subject: string; html: string; plaintext: string } {
  const sum = priceFor(planForInterval(r.plan_interval), r.grandfathered).replace('.00', '');
  const period = r.plan_interval === 'annual' ? 'год' : 'месяц';
  const date = fmtDate(r.plan_expires_at);
  const lines = [
    `${date} подписка Pro продлится автоматически: спишем ${sum} ₽ за следующий ${period} с карты, которой вы оплачивали подписку.`,
    'Если продлевать не нужно — отмените автопродление в «Настройки → Подписка» до этой даты. Доступ сохранится до конца оплаченного периода.',
  ];
  return {
    subject: `Подписка Pro продлится ${date}`,
    html: `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"></head>
<body style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px 20px;color:#1a1a1a;background:#fff;">
  ${lines.map((l) => `<p style="margin:0 0 20px;font-size:16px;line-height:1.6;">${escapeHtml(l)}</p>`).join('\n  ')}
  <p style="margin:0 0 20px;"><a href="https://avtorstudio.com/books" style="color:#a0522d;">Открыть студию</a></p>
  <p style="margin:0;font-size:13px;color:#666;">Вопросы — support@avtorstudio.com. Условия — avtorstudio.com/offer</p>
</body></html>`,
    plaintext: [...lines, '', 'Открыть студию: https://avtorstudio.com/books', 'Вопросы: support@avtorstudio.com'].join('\n'),
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  const merchantLogin   = Deno.env.get('ROBOKASSA_MERCHANT_LOGIN');
  const supabaseUrl     = Deno.env.get('SUPABASE_URL');
  const serviceKey      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const schedulerSecret = Deno.env.get('SCHEDULER_SECRET');
  const isTestMode      = Deno.env.get('ROBOKASSA_IS_TEST') === 'true';
  const password1 = (isTestMode ? Deno.env.get('ROBOKASSA_TEST_PASSWORD1') : Deno.env.get('ROBOKASSA_PASSWORD1'))?.trim();
  const password2 = (isTestMode ? Deno.env.get('ROBOKASSA_TEST_PASSWORD2') : Deno.env.get('ROBOKASSA_PASSWORD2'))?.trim();

  if (!merchantLogin || !supabaseUrl || !serviceKey || !password1 || !schedulerSecret) {
    console.error('[billing-scheduler] missing env');
    return json(500, { error: 'server misconfigured' });
  }

  const token = bearer(req);
  if (!token || !timingSafeEqual(token, schedulerSecret)) return json(401, { error: 'unauthorized' });

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const audit = async (action: string, userId: string, payload: Record<string, unknown>) => {
    const { error } = await db.from('admin_audit_log').insert({
      admin_id: SYSTEM_ADMIN_ID, admin_email: 'system', action, target_user_id: userId, payload,
    });
    if (error) console.error(`[billing-scheduler] audit ${action} failed:`, error.message);
  };

  const counts = { downgraded: 0, reminders_sent: 0, reminders_failed: 0, due: 0, charged: 0, failed: 0, skipped: 0 };

  // 1. Понижение — до проверки флага.
  const { data: downgraded, error: downErr } = await db.rpc('downgrade_expired_subscriptions');
  if (downErr) console.error('[billing-scheduler] downgrade failed:', downErr.message);
  else counts.downgraded = Array.isArray(downgraded) ? downgraded.length : 0;

  // 2. Флаг рекуррентов.
  const { data: flagRow, error: flagErr } = await db
    .from('feature_flags').select('enabled').eq('key', 'recurring_billing_enabled').maybeSingle();
  if (flagErr) {
    console.error('[billing-scheduler] flag read failed:', flagErr.message);
    return json(500, { error: 'db error', ...counts });
  }
  if (!flagRow?.enabled) {
    console.log('[billing-scheduler] recurring_billing_enabled=false, charges and reminders skipped');
    return json(200, { ...counts, recurring_disabled: true });
  }

  // 3. Напоминания.
  const { data: reminders, error: remErr } = await db.rpc('get_renewal_reminders_due');
  if (remErr) console.error('[billing-scheduler] reminders query failed:', remErr.message);
  for (const r of (reminders ?? []) as ReminderRow[]) {
    if (!isDeliverableEmail(r.email)) continue;
    const { data: claimed, error: claimErr } = await db.rpc('claim_renewal_reminder', { p_user_id: r.user_id, p_expiry: r.plan_expires_at });
    if (claimErr || !claimed) continue;
    const sent = await sendEmail({ to: r.email, ...reminderEmail(r) });
    if (sent.ok) {
      counts.reminders_sent++;
    } else {
      counts.reminders_failed++;
      console.error('[billing-scheduler] reminder send failed:', sent.error);
      const { error } = await db.rpc('release_renewal_reminder', { p_user_id: r.user_id, p_expiry: r.plan_expires_at });
      if (error) console.error('[billing-scheduler] reminder release failed:', error.message);
    }
  }

  // 4. Списания.
  const { data: dueRows, error: dueErr } = await db.rpc('get_billing_due', { p_max_attempts: MAX_ATTEMPTS });
  if (dueErr) {
    console.error('[billing-scheduler] billing_due query failed:', dueErr.message);
    return json(500, { error: 'db error', ...counts });
  }
  const rows = (dueRows ?? []) as DueRow[];
  counts.due = rows.length;

  for (const [i, p] of rows.entries()) {
    // Повтор: если прошлый дочерний счёт оплачен или ещё обрабатывается — не списываем снова.
    // Без password2 статус не узнать — повтор откладывается, а не идёт вслепую.
    if (p.is_retry && p.pending_inv_id) {
      const state = password2 ? await fetchOpState(merchantLogin, p.pending_inv_id, password2) : null;
      const verdict = retryDecision(state);
      if (verdict !== 'charge') {
        counts.skipped++;
        if (verdict === 'postpone') {
          console.warn(`[billing-scheduler] OpStateExt unavailable for pending ${p.pending_inv_id}, retry postponed`);
        }
        if (verdict === 'paid') {
          await audit('recurring_paid_webhook_missing', p.user_id, { inv_id: p.pending_inv_id });
        }
        continue;
      }
    }

    const { data: attempt, error: claimErr } = await db.rpc('claim_billing_attempt', {
      p_user_id: p.user_id, p_expiry: p.plan_expires_at, p_max_attempts: MAX_ATTEMPTS,
    });
    if (claimErr) {
      counts.failed++;
      console.error('[billing-scheduler] claim failed:', claimErr.message);
      continue;
    }
    if (attempt === null || attempt === undefined) {
      counts.skipped++;
      continue;
    }

    const interval: BillingInterval = p.plan_interval === 'annual' ? 'annual' : 'monthly';
    const shpPlan = planForInterval(interval);
    // BILLING_TEST_AMOUNT — только в тест-режиме.
    const outSum = (isTestMode ? Deno.env.get('BILLING_TEST_AMOUNT') : null) ?? priceFor(shpPlan, p.grandfathered);
    const description = DESCRIPTIONS[shpPlan];
    const invId = newInvId(i);
    const receipt = buildReceipt(description, outSum, p.email);

    const { error: payErr } = await db.from('payments').insert({
      inv_id: invId, user_id: p.user_id, amount: parseFloat(outSum), plan: shpPlan, source: 'recurring',
      for_expiry: p.plan_expires_at,
    });
    if (payErr) {
      counts.failed++;
      console.error('[billing-scheduler] payments insert failed:', payErr.message);
      await audit('recurring_charge_failed', p.user_id, { inv_id: invId, attempt, reason: 'payments_insert_failed' });
      continue;
    }

    const signature = md5hex(`${merchantLogin}:${outSum}:${invId}:${receipt.json}:${password1}:Shp_plan=${shpPlan}:Shp_user_id=${p.user_id}`);
    const body = new URLSearchParams({
      MerchantLogin:     merchantLogin,
      InvId:             invId,
      OutSum:            outSum,
      Description:       description,
      PreviousInvoiceID: p.recurring_inv_id,
      SignatureValue:    signature,
      IsTest:            isTestMode ? '1' : '0',
      Shp_plan:          shpPlan,
      Shp_user_id:       p.user_id,
    });

    try {
      const resp = await fetch(RECURRING_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `${body.toString()}&Receipt=${receipt.encoded}`,
      });
      const respText = (await resp.text()).slice(0, 300);
      if (!resp.ok || !respText.startsWith('OK')) {
        counts.failed++;
        await audit('recurring_charge_failed', p.user_id, { inv_id: invId, attempt, response: respText });
        continue;
      }
      counts.charged++;
      await audit('recurring_charge_initiated', p.user_id, {
        inv_id: invId, amount: outSum, previous_inv_id: p.recurring_inv_id, plan_interval: interval, attempt,
      });
    } catch (e) {
      counts.failed++;
      const msg = e instanceof Error ? e.message : String(e);
      await audit('recurring_charge_failed', p.user_id, { inv_id: invId, attempt, error: msg });
    }
  }

  console.log('[billing-scheduler] done', JSON.stringify(counts));
  return json(200, counts);
});
