// supabase/functions/cancel-subscription/index.ts
//
// Отмена и возобновление Pro-подписки пользователем. Bearer пользователя, verify_jwt: true.
// POST                → cancel_at_period_end = true  (отмена). Body: { reason, comment? }
// POST ?resume=true   → cancel_at_period_end = false (возобновление)
//
// Причина отмены пишется здесь (service role) только после успешной отмены — клиентский
// INSERT в cancellation_reasons отозван (20261022000100). Сбой записи причины отмену не откатывает.
// Доступ сохраняется до plan_expires_at; billing-scheduler понижает отменённую сразу по истечении.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { SYSTEM_ADMIN_ID, bearer, corsHeaders, json } from '../_shared/http.ts';

const REASONS = new Set(['price', 'not_writing', 'missing_features', 'bugs', 'other_tool', 'other']);

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' }, cors);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    console.error('[cancel-subscription] missing env');
    return json(500, { error: 'server misconfigured' }, cors);
  }

  const token = bearer(req);
  if (!token) return json(401, { error: 'missing auth' }, cors);

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: { user }, error: userError } = await db.auth.getUser(token);
  if (userError || !user) return json(401, { error: 'invalid token' }, cors);

  const isResume = new URL(req.url).searchParams.get('resume') === 'true';

  let reason: string | null = null;
  let comment: string | null = null;
  if (!isResume) {
    try {
      const body = await req.json();
      if (typeof body?.reason === 'string' && REASONS.has(body.reason)) reason = body.reason;
      if (typeof body?.comment === 'string') comment = body.comment.trim().slice(0, 2000) || null;
    } catch { /* тело необязательно */ }
  }

  const { data: profile, error: profileErr } = await db
    .from('profiles')
    .select('plan, plan_expires_at, recurring_inv_id, plan_interval')
    .eq('user_id', user.id)
    .single();
  if (profileErr || !profile) {
    console.error('[cancel-subscription] profile fetch failed:', profileErr?.message);
    return json(500, { error: 'db error' }, cors);
  }

  if (profile.plan !== 'pro') return json(422, { error: 'not_pro' }, cors);
  if (!profile.recurring_inv_id) return json(422, { error: 'no_recurring' }, cors);

  const { error: updateErr } = await db
    .from('profiles')
    .update({ cancel_at_period_end: !isResume })
    .eq('user_id', user.id);
  if (updateErr) {
    console.error('[cancel-subscription] update failed:', updateErr.message);
    return json(500, { error: 'db error' }, cors);
  }

  const { error: auditErr } = await db.from('admin_audit_log').insert({
    admin_id: SYSTEM_ADMIN_ID,
    admin_email: 'system',
    action: isResume ? 'subscription_resumed' : 'subscription_cancelled',
    target_user_id: user.id,
    payload: { plan_expires_at: profile.plan_expires_at, ...(reason ? { reason } : {}) },
  });
  if (auditErr) console.error('[cancel-subscription] audit failed:', auditErr.message);

  if (!isResume && reason) {
    const { error: reasonErr } = await db.from('cancellation_reasons').insert({
      user_id: user.id,
      reason,
      comment,
      plan: profile.plan_interval === 'annual' ? 'pro_annual' : 'pro',
    });
    if (reasonErr) console.error('[cancel-subscription] reason insert failed:', reasonErr.message);
  }

  return json(200, { success: true, cancelled: !isResume, expires_at: profile.plan_expires_at }, cors);
});
