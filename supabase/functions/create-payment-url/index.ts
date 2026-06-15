// supabase/functions/create-payment-url/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { Md5 } from 'https://esm.sh/ts-md5@1.3.1';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BASE_PRICES: Record<string, string> = {
  pro:        '399.00',
  pro_annual: '3490.00',
  lifetime:   '4990.00',
};

// Грандфазерская цена — сохраняется навсегда для profiles.grandfathered = true
const GRANDFATHERED_PRICES: Record<string, string> = {
  pro:        '290.00',
  pro_annual: '2900.00',
};

const DESCRIPTIONS: Record<string, string> = {
  pro:        'Подписка Pro — Авторская студия',
  pro_annual: 'Подписка Pro (год) — Авторская студия',
  lifetime:   'Lifetime — Авторская студия',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function md5hex(input: string): string {
  return Md5.hashStr(input) as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  const merchantLogin = Deno.env.get('ROBOKASSA_MERCHANT_LOGIN');
  const supabaseUrl   = Deno.env.get('SUPABASE_URL');
  const serviceKey    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const isTestMode    = Deno.env.get('ROBOKASSA_IS_TEST') === 'true';
  const password1     = isTestMode
    ? Deno.env.get('ROBOKASSA_TEST_PASSWORD1')?.trim()
    : Deno.env.get('ROBOKASSA_PASSWORD1')?.trim();

  if (!merchantLogin || !supabaseUrl || !serviceKey || !password1) {
    console.error('[create-payment-url] missing env');
    return json(500, { error: 'server misconfigured' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json(401, { error: 'missing auth' });
  }
  const token = authHeader.slice(7);

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: { user }, error: userError } = await db.auth.getUser(token);
  if (userError || !user) {
    return json(401, { error: 'invalid token' });
  }

  let plan: string;
  try {
    const body = await req.json();
    plan = body?.plan;
  } catch {
    return json(400, { error: 'invalid body' });
  }

  if (!BASE_PRICES[plan]) {
    return json(400, { error: `unknown plan: ${plan}` });
  }

  // Проверяем грандфазерский флаг — ранние пользователи платят 290₽/2900₽ навсегда
  const { data: profile } = await db
    .from('profiles')
    .select('grandfathered')
    .eq('user_id', user.id)
    .single();
  const isGrandfathered = profile?.grandfathered === true;

  const outSum = (isGrandfathered && GRANDFATHERED_PRICES[plan])
    ? GRANDFATHERED_PRICES[plan]
    : BASE_PRICES[plan];
  const invId       = String(Date.now());
  const shpPlan     = plan;
  const shpUserId   = user.id;
  const result2Url  = `${supabaseUrl}/functions/v1/payment-result2`;

  // Receipt с номенклатурой (обязателен по ФЗ-54)
  // tax: 'none' — без НДС (СМЗ/УСН). Если ОСНО → менять на 'vat20'.
  // email — куда Robokassa отправит электронный чек покупателю.
  const receipt: Record<string, unknown> = {
    items: [{
      name: DESCRIPTIONS[plan],
      quantity: 1,
      sum: parseFloat(outSum),
      payment_method: 'full_payment',
      payment_object: 'service',
      tax: 'none',
    }],
  };
  if (user.email) receipt['email'] = user.email;
  const receiptJson    = JSON.stringify(receipt);
  const receiptEncoded = encodeURIComponent(receiptJson);

  // Порядок подписи: MerchantLogin:OutSum:InvId:Receipt:ResultUrl2:Password1:Shp_...
  const sigString = `${merchantLogin}:${outSum}:${invId}:${receiptEncoded}:${result2Url}:${password1}:Shp_plan=${shpPlan}:Shp_user_id=${shpUserId}`;
  const signature = md5hex(sigString);

  const params = new URLSearchParams({
    MerchantLogin:  merchantLogin,
    OutSum:         outSum,
    InvId:          invId,
    Description:    DESCRIPTIONS[plan],
    SignatureValue: signature,
    IsTest:         isTestMode ? '1' : '0',
    ResultUrl2:     result2Url,
    Shp_plan:       shpPlan,
    Shp_user_id:    shpUserId,
  });

  // Receipt добавляем вручную — encodeURIComponent, не двойное кодирование через URLSearchParams
  const url = `https://auth.robokassa.ru/Merchant/Index.aspx?${params.toString()}&Receipt=${receiptEncoded}`;
  console.log(`[create-payment-url] plan=${plan} invId=${invId} userId=${user.id} isTest=${isTestMode}`);
  return json(200, { url });
});
