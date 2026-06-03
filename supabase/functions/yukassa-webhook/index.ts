// ЮKassa Webhook — обработка успешных платежей.
//
// Поддерживает три типа плана (metadata.plan):
//   'pro'          → месячная подписка Pro (+31 день)
//   'pro_annual'   → годовая подписка Pro (+365 дней)
//   'lifetime'     → разовый Lifetime (атомарно декрементирует счётчик слотов)
//
// Грандфазеринг (§7): если переменная окружения GRANDFATHERING_ENDS_AT установлена
//   и текущая дата раньше неё → при первой Pro-подписке ставим profiles.grandfathered = true.
//
// Верификация: после получения вебхука делаем GET /v3/payments/:id к ЮKassa API
//   и проверяем status === 'succeeded' && paid === true (защита от подделки).
//
// Обязательные env (Supabase Secrets):
//   YUKASSA_SHOP_ID, YUKASSA_SECRET_KEY
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (предоставляются Supabase автоматически)
// Опциональный env:
//   GRANDFATHERING_ENDS_AT — ISO-дата окончания грандфазеринга, например '2026-09-01'

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

async function logPayment(
  db: ReturnType<typeof createClient>,
  userId: string,
  payment: YookassaPayment,
  plan: string,
): Promise<void> {
  await db.from('admin_audit_log').insert({
    admin_id: '00000000-0000-0000-0000-000000000000',
    admin_email: 'system',
    action: 'payment_received',
    target_user_id: userId,
    payload: {
      amount: payment.amount.value,
      currency: payment.amount.currency,
      plan,
      payment_id: payment.id,
    },
  });
}

interface YookassaAmount {
  value: string;
  currency: string;
}

interface YookassaPayment {
  id: string;
  status: string;
  paid: boolean;
  amount: YookassaAmount;
  metadata?: {
    user_id?: string;
    plan?: string;
  };
}

interface WebhookBody {
  type: string;
  event: string;
  object: YookassaPayment;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  const shopId = Deno.env.get('YUKASSA_SHOP_ID');
  const secretKey = Deno.env.get('YUKASSA_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!shopId || !secretKey || !supabaseUrl || !serviceKey) {
    return json(500, { error: 'env not configured' });
  }

  let body: WebhookBody;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid json' });
  }

  // Пропускаем все события кроме payment.succeeded
  if (body.type !== 'notification' || body.event !== 'payment.succeeded') {
    return json(200, { ok: true, skipped: true });
  }

  const paymentId = body.object?.id;
  if (!paymentId) return json(400, { error: 'missing payment id' });

  // Верификация через ЮKassa API — единственный надёжный способ
  const verifyRes = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
    headers: {
      Authorization: 'Basic ' + btoa(`${shopId}:${secretKey}`),
      'Content-Type': 'application/json',
    },
  });
  if (!verifyRes.ok) {
    return json(502, { error: `yukassa api error: ${verifyRes.status}` });
  }

  const payment: YookassaPayment = await verifyRes.json();
  if (payment.status !== 'succeeded' || !payment.paid) {
    return json(200, { ok: true, skipped: 'not succeeded' });
  }

  const userId = payment.metadata?.user_id;
  const plan = payment.metadata?.plan;

  if (!userId || !plan) {
    return json(400, { error: 'missing user_id or plan in payment metadata' });
  }

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  if (plan === 'lifetime') {
    // §6: Атомарно декрементируем счётчик слотов
    const { data: slotOk, error: slotErr } = await db.rpc('decrement_lifetime_slot');
    if (slotErr) {
      return json(500, { error: `slot decrement failed: ${slotErr.message}` });
    }
    if (!slotOk) {
      // Слоты закончились — не блокируем пользователя (это edge case),
      // но пишем в лог. Можно добавить нотификацию разработчику.
      console.error('[yukassa-webhook] no lifetime slots remaining for user:', userId);
    }

    const { error } = await db
      .from('profiles')
      .update({ plan: 'lifetime', plan_expires_at: null })
      .eq('user_id', userId);

    if (error) return json(500, { error: `profiles update failed: ${error.message}` });
    await logPayment(db, userId, payment, plan);

  } else if (plan === 'pro' || plan === 'pro_annual') {
    const daysToAdd = plan === 'pro_annual' ? 365 : 31;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + daysToAdd);

    // §7: Грандфазеринг — ставим true если период фазы 1 ещё не закончился
    const grandfatheringEndsAt = Deno.env.get('GRANDFATHERING_ENDS_AT');
    const isGrandfathering = grandfatheringEndsAt
      ? new Date() < new Date(grandfatheringEndsAt)
      : false;

    const updateData: Record<string, unknown> = {
      plan: 'pro',
      plan_expires_at: expiresAt.toISOString(),
    };
    if (isGrandfathering) {
      updateData.grandfathered = true;
    }

    const { error } = await db
      .from('profiles')
      .update(updateData)
      .eq('user_id', userId);

    if (error) return json(500, { error: `profiles update failed: ${error.message}` });
    await logPayment(db, userId, payment, plan);

  } else {
    return json(400, { error: `unknown plan: ${plan}` });
  }

  return json(200, { ok: true });
});
