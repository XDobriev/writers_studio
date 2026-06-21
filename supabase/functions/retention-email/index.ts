import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UNISENDER_URL =
  'https://goapi.unisender.ru/ru/transactional/api/v1/email/send.json';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function buildHtml(name: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px 20px;color:#1a1a1a;background:#fff;">
  <p style="margin:0 0 24px;font-size:17px;line-height:1.7;">${name},</p>
  <p style="margin:0 0 24px;font-size:17px;line-height:1.7;">
    Прошла неделя с вашего последнего визита.<br>
    <strong>«${title}»</strong> всё ещё здесь — ждёт продолжения.
  </p>
  <p style="margin:0 0 32px;font-size:17px;line-height:1.7;">
    Один абзац сегодня — и текст снова движется.
  </p>
  <p style="margin:0 0 40px;">
    <a href="https://avtorstudio.com/books"
       style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:14px 28px;border-radius:6px;font-size:15px;font-family:system-ui,sans-serif;">
      Вернуться к книге →
    </a>
  </p>
  <p style="margin:0;font-size:14px;line-height:1.7;color:#666;">
    Если что-то мешает писать — просто ответьте на это письмо.<br>
    — Хамзат, автор студии
  </p>
</body>
</html>`;
}

function buildPlaintext(name: string, title: string): string {
  return [
    `${name},`,
    ``,
    `Прошла неделя с вашего последнего визита.`,
    `«${title}» всё ещё здесь — ждёт продолжения.`,
    ``,
    `Один абзац сегодня — и текст снова движется.`,
    ``,
    `Вернуться к книге: https://avtorstudio.com/books`,
    ``,
    `— Хамзат, автор студии`,
  ].join('\n');
}

type InactiveUser = {
  user_id: string;
  email: string;
  display_name: string | null;
  book_title: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  const supabaseUrl  = Deno.env.get('SUPABASE_URL');
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const cronSecret   = Deno.env.get('CRON_SECRET');
  const unisenderKey = Deno.env.get('UNISENDER_GO_API_KEY');

  if (!supabaseUrl || !serviceKey || !cronSecret || !unisenderKey) {
    console.error('[retention-email] missing env');
    return json(500, { error: 'server misconfigured' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ') || authHeader.slice(7) !== cronSecret) {
    return json(401, { error: 'unauthorized' });
  }

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: users, error: fetchErr } = await db.rpc('get_inactive_users_for_retention');
  if (fetchErr) {
    console.error('[retention-email] rpc error', fetchErr);
    return json(500, { error: fetchErr.message });
  }

  if (!users || (users as InactiveUser[]).length === 0) {
    console.log('[retention-email] no inactive users today');
    return json(200, { sent: 0 });
  }

  let sent = 0;
  const failed: string[] = [];

  for (const user of users as InactiveUser[]) {
    const name  = user.display_name || 'Автор';
    const title = user.book_title   || 'ваша книга';

    try {
      const resp = await fetch(UNISENDER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': unisenderKey,
        },
        body: JSON.stringify({
          message: {
            recipients: [{ email: user.email }],
            subject: `«${title}» ждёт вас`,
            from_email: 'studio@avtorstudio.com',
            from_name: 'Авторская студия',
            body: {
              html: buildHtml(name, title),
              plaintext: buildPlaintext(name, title),
            },
            track_links: 1,
            track_read: 1,
          },
        }),
      });

      const result = await resp.json();

      if (result.status === 'success') {
        await db
          .from('profiles')
          .update({ retention_email_sent_at: new Date().toISOString() })
          .eq('user_id', user.user_id);
        sent++;
        console.log(`[retention-email] sent → ${user.email}`);
      } else {
        console.error(`[retention-email] api error for ${user.email}:`, result);
        failed.push(user.email);
      }
    } catch (err) {
      console.error(`[retention-email] exception for ${user.email}:`, err);
      failed.push(user.email);
    }
  }

  console.log(`[retention-email] done: sent=${sent} failed=${failed.length}`);
  return json(200, { sent, failed_count: failed.length, failed });
});
