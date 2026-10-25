// Retention-письмо неактивным 7+ дней (раз в неделю на пользователя).
// Запуск: pg_cron 07:00 UTC (20261022000900), резерв — ручной workflow. Bearer = CRON_SECRET.
// Деплой: --no-verify-jwt.
//
// display_name и название книги — пользовательский ввод (подтверждения email нет):
// обрезаются и экранируются, иначе письмо от studio@avtorstudio.com можно было
// превратить в фишинг. Адреса *.local (Telegram/VK) не получают писем — их отсекает и
// get_inactive_users_for_retention (20261022000300), и проверка здесь.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { clip, escapeHtml, timingSafeEqual } from '../_shared/crypto.ts';
import { bearer, json } from '../_shared/http.ts';
import { isDeliverableEmail, sendEmail } from '../_shared/email.ts';

function buildHtml(name: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px 20px;color:#1a1a1a;background:#fff;">
  <p style="margin:0 0 24px;font-size:17px;line-height:1.7;">${escapeHtml(name)},</p>
  <p style="margin:0 0 24px;font-size:17px;line-height:1.7;">
    Вы давно не заходили в студию.<br>
    <strong>«${escapeHtml(title)}»</strong> всё ещё здесь — ждёт продолжения.
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
    `Вы давно не заходили в студию.`,
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
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const cronSecret  = Deno.env.get('CRON_SECRET');
  if (!supabaseUrl || !serviceKey || !cronSecret || !Deno.env.get('RESEND_API_KEY')) {
    console.error('[retention-email] missing env');
    return json(500, { error: 'server misconfigured' });
  }

  const token = bearer(req);
  if (!token || !timingSafeEqual(token, cronSecret)) return json(401, { error: 'unauthorized' });

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: users, error: fetchErr } = await db.rpc('get_inactive_users_for_retention');
  if (fetchErr) {
    console.error('[retention-email] rpc error', fetchErr.message);
    return json(500, { error: 'db error' });
  }

  let sent = 0;
  let failed = 0;
  for (const user of (users ?? []) as InactiveUser[]) {
    if (!isDeliverableEmail(user.email)) continue;
    const name  = clip(user.display_name || 'Автор', 60);
    const title = clip(user.book_title || 'ваша книга', 80);

    const res = await sendEmail({
      to: user.email,
      subject: `«${title}» ждёт вас`,
      html: buildHtml(name, title),
      plaintext: buildPlaintext(name, title),
    });
    if (res.ok) {
      const { error } = await db
        .from('profiles')
        .update({ retention_email_sent_at: new Date().toISOString() })
        .eq('user_id', user.user_id);
      if (error) console.error('[retention-email] mark sent failed:', error.message);
      sent++;
    } else {
      console.error('[retention-email] send failed:', res.error);
      failed++;
    }
  }

  console.log(`[retention-email] done: sent=${sent} failed=${failed}`);
  return json(200, { sent, failed_count: failed });
});
