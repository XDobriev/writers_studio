// supabase/functions/create-payment-url/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { Md5 } from 'https://esm.sh/ts-md5@1.3.1';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PRICES: Record<string, string> = {
  pro: '290.00',
  lifetime: '4990.00',
};

const DESCRIPTIONS: Record<string, string> = {
  pro: 'Подписка Pro — Авторская студия',
  lifetime: 'Lifetime — Авторская студия',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function md5hex(input: string): string {
  return new Md5().update(input).toString('hex');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  const merchantLogin = Deno.env.get('ROBOKASSA_MERCHANT_LOGIN');
  const supabaseUrl   = Deno.env.get('SUPABASE_URL');
  const serviceKey    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const isTestMode    = Deno.env.get('ROBOKASSA_IS_TEST') === 'true';
  const password1     = isTestMode
    ? Deno.env.get('ROBOKASSA_TEST_PASSWORD1')
    : Deno.env.get('ROBOKASSA_PASSWORD1');

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

  if (!PRICES[plan]) {
    return json(400, { error: `unknown plan: ${plan}` });
  }

  const outSum    = PRICES[plan];
  const invId     = String(Math.floor(Date.now() / 1000) % 2_147_483_647);
  const shpPlan   = plan;
  const shpUserId = user.id;

  // Shp-параметры сортируются алфавитно: Shp_plan < Shp_user_id
  const sigString = `${merchantLogin}:${outSum}:${invId}:${password1}:Shp_plan=${shpPlan}:Shp_user_id=${shpUserId}`;
  const signature = md5hex(sigString);

  const params = new URLSearchParams({
    MerchantLogin:  merchantLogin,
    OutSum:         outSum,
    InvId:          invId,
    Description:    DESCRIPTIONS[plan],
    SignatureValue: signature,
    IsTest:         isTestMode ? '1' : '0',
    Shp_plan:       shpPlan,
    Shp_user_id:    shpUserId,
  });

  const url = `https://auth.robokassa.ru/Merchant/Index.aspx?${params.toString()}`;
  console.log(`[create-payment-url] plan=${plan} invId=${invId} userId=${user.id} isTest=${isTestMode}`);
  return json(200, { url });
});
