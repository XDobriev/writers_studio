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

const VK_APP_ID = 54634821;

interface VkUserInfo {
  user_id: string;
  first_name?: string;
  last_name?: string;
  avatar?: string;
  email?: string;
}

interface VkUserInfoResponse {
  user?: VkUserInfo;
  error?: string;
}

interface VkApiUser {
  id: number;
  first_name?: string;
  last_name?: string;
  photo_200?: string;
}

interface VkApiResponse {
  response?: VkApiUser[];
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
  if (!access_token || user_id == null) return json(400, { error: 'access_token and user_id are required' });

  // VK ID 2.1 tokens must be verified via id.vk.com/oauth2/user_info
  let vkInfo: VkUserInfoResponse;
  try {
    const vkRes = await fetch('https://id.vk.com/oauth2/user_info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: String(VK_APP_ID), access_token }),
    });
    vkInfo = await vkRes.json() as VkUserInfoResponse;
  } catch {
    return json(502, { error: 'vk api unreachable' });
  }

  if (vkInfo.error || !vkInfo.user) {
    return json(401, { error: 'vk token invalid' });
  }

  const vkUser = vkInfo.user;
  if (Number(vkUser.user_id) !== user_id) {
    return json(401, { error: 'user_id mismatch' });
  }

  // Fetch Cyrillic names via VK classic API (lang=0 = Russian)
  let firstName = vkUser.first_name ?? null;
  let lastName = vkUser.last_name ?? null;
  let photoUrl = vkUser.avatar ?? null;

  try {
    const apiRes = await fetch('https://api.vk.com/method/users.get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        user_ids: vkUser.user_id,
        fields: 'photo_200',
        lang: '0',
        v: '5.199',
        access_token,
      }),
    });
    const apiData = await apiRes.json() as VkApiResponse;
    if (apiData.response?.[0]) {
      const u = apiData.response[0];
      firstName = u.first_name ?? firstName;
      lastName = u.last_name ?? lastName;
      photoUrl = u.photo_200 ?? photoUrl;
    }
  } catch {
    // fall back to user_info names
  }

  const email = `vk-${vkUser.user_id}@vk.local`;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const meta = {
    vk_id: Number(vkUser.user_id),
    first_name: firstName,
    last_name: lastName,
    photo_url: photoUrl,
    provider: 'vk',
  };

  let userId: string | null = null;
  let existingAppMeta: Record<string, unknown> | null = null;
  for (let page = 1; page <= 5; page++) {
    const { data: list, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return json(500, { error: `listUsers failed: ${error.message}` });
    const hit = list.users.find((u) => u.email === email);
    if (hit) {
      userId = hit.id;
      existingAppMeta = (hit.app_metadata ?? null) as Record<string, unknown> | null;
      break;
    }
    if (list.users.length < 200) break;
  }

  if (!userId) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: meta,
      app_metadata: { provider: 'vk', vk_id: Number(vkUser.user_id) },
    });
    if (error || !created.user) return json(500, { error: `createUser failed: ${error?.message ?? 'unknown'}` });
    userId = created.user.id;
  } else {
    // Guard against pre-hijacking: reject if existing account was not created via VK.
    // app_metadata is server-controlled and cannot be set by users through signUp.
    if (existingAppMeta?.provider !== 'vk') {
      return json(409, { error: 'email conflict: account exists with different provider' });
    }
    const { error: updateErr } = await admin.auth.admin.updateUserById(userId, { user_metadata: meta });
    if (updateErr) return json(500, { error: `updateUser failed: ${updateErr.message}` });
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
