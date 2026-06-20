// supabase/functions/cancel-subscription/index.ts
//
// Отмена и возобновление Pro-подписки пользователем.
// POST                → cancel_at_period_end = true  (отмена)
// POST ?resume=true   → cancel_at_period_end = false (возобновление)
//
// Условие отмены: plan = 'pro', recurring_inv_id IS NOT NULL.
// После отмены доступ сохраняется до plan_expires_at.
// billing-scheduler пропускает пользователей с cancel_at_period_end = true,
// и даунгрейдит план до 'free' когда plan_expires_at наступает.
//
// Secrets (автоматические): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    console.error('[cancel-subscription] missing env');
    return json(500, { error: 'server misconfigured' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json(401, { error: 'missing auth' });
  const token = authHeader.slice(7);

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: { user }, error: userError } = await db.auth.getUser(token);
  if (userError || !user) return json(401, { error: 'invalid token' });

  const isResume = new URL(req.url).searchParams.get('resume') === 'true';

  const { data: profile, error: profileErr } = await db
    .from('profiles')
    .select('plan, plan_expires_at, recurring_inv_id')
    .eq('user_id', user.id)
    .single();

  if (profileErr || !profile) {
    console.error('[cancel-subscription] profile fetch failed:', profileErr?.message);
    return json(500, { error: 'db error' });
  }

  if (profile.plan !== 'pro') {
    return json(422, { error: 'not_pro' });
  }

  if (!isResume && !profile.recurring_inv_id) {
    // Разовая покупка без рекуррентного инвойса — отменять нечего
    return json(422, { error: 'no_recurring' });
  }

  const { error: updateErr } = await db
    .from('profiles')
    .update({ cancel_at_period_end: !isResume })
    .eq('user_id', user.id);

  if (updateErr) {
    console.error('[cancel-subscription] update failed:', updateErr.message);
    return json(500, { error: 'db error' });
  }

  await db.from('admin_audit_log').insert({
    admin_id:       '00000000-0000-0000-0000-000000000000',
    admin_email:    'system',
    action:         isResume ? 'subscription_resumed' : 'subscription_cancelled',
    target_user_id: user.id,
    payload:        { plan_expires_at: profile.plan_expires_at },
  });

  console.log(`[cancel-subscription] userId=${user.id} action=${isResume ? 'resume' : 'cancel'} expires_at=${profile.plan_expires_at}`);

  return json(200, {
    success:    true,
    cancelled:  !isResume,
    expires_at: profile.plan_expires_at,
  });
});
