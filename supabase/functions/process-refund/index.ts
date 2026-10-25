// supabase/functions/process-refund/index.ts
//
// Возврат последнего Pro-платежа пользователя (14 дней). Bearer пользователя, verify_jwt: true.
//   * только подтверждённые платежи (confirmed_at IS NOT NULL) — пред-созданные
//     pending-строки scheduler'а / create-payment-url не выбираются; дубли автосписания
//     (duplicate_reason, L-8) тоже: их возвращает robokassa-webhook без apply_refund;
//   * claim-first refunded_at до вызова Робокассы (двойной возврат невозможен);
//   * после одобрения — public.apply_refund: снимается ровно оплаченный этим платежом
//     период (если оплачен и следующий — Pro остаётся до новой даты), рекуррент
//     закрывается (recurring_inv_id = NULL), ранняя цена сгорает.
//   * повтор по уже возвращённому OpKey (ответ первой попытки потерялся) Робокасса отклоняет
//     с NotEnoughOperationFunds: claim остаётся, автопродление выключается
//     (cancel_at_period_end — обратимо, мандат не стирается), план не трогаем — деньги
//     могли и не вернуться; audit refund_needs_review, сверяет админ;
//   * Refund error 8401 — на балансе магазина нет всей суммы возврата: claim снимается
//     (пользователь повторит после пополнения), audit refund_balance_insufficient,
//     уведомление владельцу в Telegram;
//   * статус 'processing' после 20 с поллинга считается успехом (Робокасса приняла заявку);
//     отмену такой заявки позже нужно сверять вручную (см. отчёт).
//
// Secrets: ROBOKASSA_PASSWORD3, ROBOKASSA_MERCHANT_LOGIN, ROBOKASSA_PASSWORD2 (fallback OpKey).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { SYSTEM_ADMIN_ID, bearer, corsHeaders, json } from '../_shared/http.ts';
import { fetchOpKey } from '../_shared/robokassa.ts';
import { createRefund, pollRefundState } from '../_shared/refund.ts';
import { notifyOwner } from '../_shared/telegram.ts';

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
    .select('id, inv_id, op_key, amount')
    .eq('user_id', user.id)
    .in('plan', ['pro', 'pro_annual'])
    .not('confirmed_at', 'is', null)
    .is('refunded_at', null)
    .is('duplicate_reason', null)
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
    const result = await createRefund(opKey, password3);
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
      await notifyOwner(`Возврат: повтор по уже возвращённой операции inv=${payment.inv_id}. Автопродление выключено. Сверить в ЛК Робокассы и выполнить apply_refund.`);
      return json(409, { error: 'refund_already_created' }, cors);
    }
    if (result.kind === 'insufficient_balance') {
      console.error(`[process-refund] Refund error 8401 (balance) inv=${payment.inv_id} amount=${payment.amount}`);
      await releaseRefundClaim();
      const { error: auditErr } = await db.from('admin_audit_log').insert({
        admin_id: SYSTEM_ADMIN_ID,
        admin_email: 'system',
        action: 'refund_balance_insufficient',
        target_user_id: user.id,
        payload: { inv_id: payment.inv_id, amount: payment.amount },
      });
      if (auditErr) console.error('[process-refund] audit failed:', auditErr.message);
      await notifyOwner(`Возврат не прошёл: на балансе Робокассы меньше ${payment.amount} ₽ (inv=${payment.inv_id}). Пополнить баланс — пользователь повторит.`);
      return json(503, { error: 'refund_balance_insufficient' }, cors);
    }
    if (result.kind === 'rejected') {
      await releaseRefundClaim();
      return json(502, { error: 'robokassa_error' }, cors);
    }
    requestId = result.requestId;
  } catch (e) {
    console.error('[process-refund] Robokassa fetch failed:', e instanceof Error ? e.message : String(e));
    await releaseRefundClaim();
    return json(502, { error: 'robokassa_unreachable' }, cors);
  }

  const label = await pollRefundState(requestId);
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
