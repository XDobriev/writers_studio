// Письмо об успешной оплате (первая покупка и каждое рекуррентное продление).
// Вызывается из robokassa-webhook в фоне с Bearer = SUPABASE_SERVICE_ROLE_KEY
// (сверяется здесь за постоянное время). Деплой: --no-verify-jwt.
//
// Secrets: UNISENDER_GO_API_KEY (как retention-email, хост goapi.unisender.ru),
// EMAIL_FROM (необязателен). Синтетические адреса *.local (Telegram/VK) пропускаются.
import { escapeHtml, timingSafeEqual } from '../_shared/crypto.ts';
import { bearer, json } from '../_shared/http.ts';
import { isDeliverableEmail, sendEmail } from '../_shared/email.ts';

type ConfirmPlan = 'pro_monthly' | 'pro_yearly' | 'lifetime';

interface PaymentConfirmationPayload {
  user_email: string;
  transaction_id: string;
  amount: string;
  plan: ConfirmPlan;
  plan_expires_at?: string;
  auto_renew?: boolean;
}

function planLabel(plan: ConfirmPlan): string {
  switch (plan) {
    case 'pro_monthly': return 'Pro — ежемесячная подписка';
    case 'pro_yearly':  return 'Pro — годовая подписка';
    case 'lifetime':    return 'Lifetime — постоянный доступ';
  }
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' });
}

function periodLine(p: PaymentConfirmationPayload): string | null {
  if (p.plan === 'lifetime' || !p.plan_expires_at) return null;
  return p.auto_renew
    ? `Оплачено до ${fmtDate(p.plan_expires_at)}. Следующее списание — в этот день, если не отменить подписку в настройках.`
    : `Оплачено до ${fmtDate(p.plan_expires_at)}. Автопродление не подключено.`;
}

function buildEmailHtml(p: PaymentConfirmationPayload): string {
  const label = escapeHtml(planLabel(p.plan));
  const amount = escapeHtml(p.amount);
  const tx = escapeHtml(p.transaction_id);
  const period = periodLine(p);
  const periodHtml = period ? `<p style="margin:0 0 8px;font-size:14px;color:#3d3730;">${escapeHtml(period)}</p>` : '';

  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><title>Подтверждение оплаты</title></head>
<body style="margin:0;padding:0;background:#f5f3ee;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 24px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:8px;padding:40px 48px;border:1px solid #e0dbd4;">
        <tr><td>
          <p style="margin:0 0 32px;font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#7a6e62;">АВТОРСКАЯ СТУДИЯ</p>
          <h1 style="margin:0 0 8px;font-size:28px;font-weight:600;color:#1a1714;letter-spacing:-0.01em;">Оплата получена</h1>
          <p style="margin:0 0 32px;font-size:15px;color:#5a5249;">Спасибо. Ваш тариф активирован.</p>
          <hr style="border:none;border-top:1px solid #e8e3dc;margin:0 0 24px">
          <p style="margin:0 0 8px;font-size:14px;color:#3d3730;"><strong>Тариф:</strong> ${label}</p>
          <p style="margin:0 0 8px;font-size:14px;color:#3d3730;"><strong>Сумма:</strong> ${amount} ₽</p>
          ${periodHtml}
          <p style="margin:0 0 24px;font-size:13px;color:#8a7f76;font-family:'IBM Plex Mono',monospace;">Счёт: ${tx}</p>
          <hr style="border:none;border-top:1px solid #e8e3dc;margin:0 0 24px">
          <p style="margin:0 0 16px;font-size:14px;color:#5a5249;line-height:1.65;">
            Если у вас есть вопросы — напишите на
            <a href="mailto:support@avtorstudio.com" style="color:#a0522d;">support@avtorstudio.com</a>.
            Возврат в течение 14 дней по условиям
            <a href="https://avtorstudio.com/offer" style="color:#a0522d;">оферты</a>.
          </p>
          <p style="margin:0;font-size:13px;color:#8a7f76;">
            <a href="https://avtorstudio.com" style="color:#a0522d;text-decoration:none;">avtorstudio.com</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildEmailText(p: PaymentConfirmationPayload): string {
  const period = periodLine(p);
  return [
    'АВТОРСКАЯ СТУДИЯ — Подтверждение оплаты',
    '',
    `Тариф: ${planLabel(p.plan)}`,
    `Сумма: ${p.amount} ₽`,
    ...(period ? [period] : []),
    `Счёт: ${p.transaction_id}`,
    '',
    'По вопросам: support@avtorstudio.com',
    'Условия возврата: avtorstudio.com/offer',
  ].join('\n');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) return json(500, { error: 'server misconfigured' });
  const token = bearer(req);
  if (!token || !timingSafeEqual(token, serviceKey)) return json(401, { error: 'unauthorized' });

  let payload: PaymentConfirmationPayload;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: 'invalid json' });
  }

  const { user_email, transaction_id, amount, plan } = payload;
  if (!user_email || !transaction_id || !amount || !['pro_monthly', 'pro_yearly', 'lifetime'].includes(plan)) {
    return json(400, { error: 'missing or invalid fields' });
  }
  if (!isDeliverableEmail(user_email)) return json(200, { ok: true, skipped: 'undeliverable address' });

  const sent = await sendEmail({
    to: user_email,
    subject: `Оплата подтверждена — ${planLabel(plan)}`,
    html: buildEmailHtml(payload),
    plaintext: buildEmailText(payload),
  });
  if (!sent.ok) {
    console.error(`[payment-confirmation] send failed tx=${transaction_id}: ${sent.error}`);
    return json(502, { error: 'send failed' });
  }
  return json(200, { ok: true });
});
