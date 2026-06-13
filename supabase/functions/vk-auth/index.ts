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

interface VkUserResponse {
  response?: Array<{ id: number; first_name?: string; last_name?: string; photo_100?: string }>;
  error?: { error_code: number; error_msg: string };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return json(500, { error: 'supabase env is not set' });

  let body: { access_token?: string; user_id?: number };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid json' });
  }

  const { access_token, user_id } = body;
  if (!access_token || !user_id) return json(400, { error: 'access_token and user_id are required' });

  // Верифицируем токен через VK API
  const vkRes = await fetch(
    `https://api.vk.com/method/users.get?access_token=${encodeURIComponent(access_token)}&fields=first_name,last_name,photo_100&v=5.199`,
  );
  const vkData = await vkRes.json() as VkUserResponse;

  if (vkData.error || !vkData.response?.[0]) {
    return json(401, { error: `vk token invalid: ${vkData.error?.error_msg ?? 'no response'}` });
  }

  const vkUser = vkData.response[0];
  if (vkUser.id !== user_id) {
    return json(401, { error: 'user_id mismatch' });
  }

  const email = `vk-${vkUser.id}@vk.local`;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const meta = {
    vk_id: vkUser.id,
    first_name: vkUser.first_name ?? null,
    last_name: vkUser.last_name ?? null,
    photo_url: vkUser.photo_100 ?? null,
    provider: 'vk',
  };

  // Поиск существующего пользователя по синтетическому email
  let userId: string | null = null;
  for (let page = 1; page <= 5; page++) {
    const { data: list, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return json(500, { error: `listUsers failed: ${error.message}` });
    const hit = list.users.find((u) => u.email === email);
    if (hit) { userId = hit.id; break; }
    if (list.users.length < 200) break;
  }

  if (!userId) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: meta,
    });
    if (error || !created.user) return json(500, { error: `createUser failed: ${error?.message ?? 'unknown'}` });
    userId = created.user.id;
  } else {
    await admin.auth.admin.updateUserById(userId, { user_metadata: meta });
  }

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkErr || !link.properties) {
    return json(500, { error: `generateLink failed: ${linkErr?.message ?? 'unknown'}` });
  }

  return json(200, { token_hash: link.properties.hashed_token, email });
});
