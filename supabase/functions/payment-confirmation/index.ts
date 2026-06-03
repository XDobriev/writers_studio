// Отправляет email-подтверждение после успешной оплаты через ЮKassa.
// Вызывается из yukassa-webhook (§4) при event.type === 'payment.succeeded'.
//
// Требуемые секреты Supabase:
//   RESEND_API_KEY — ключ Resend (resend.com)
//   EMAIL_FROM     — отправитель, например "Авторская студия <noreply@avtorstudio.com>"

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

interface PaymentConfirmationPayload {
  user_email: string;
  transaction_id: string;
  amount: string;
  plan: 'pro_monthly' | 'pro_yearly' | 'lifetime';
  plan_expires_at?: string;
}

function planLabel(plan: PaymentConfirmationPayload['plan']): string {
  switch (plan) {
    case 'pro_monthly': return 'Pro — ежемесячная подписка';
    case 'pro_yearly':  return 'Pro — годовая подписка';
    case 'lifetime':    return 'Lifetime — постоянный доступ';
  }
}

function buildEmailHtml(payload: PaymentConfirmationPayload): string {
  const { transaction_id, amount, plan, plan_expires_at } = payload;
  const label = planLabel(plan);
  const expiresLine = plan_expires_at
    ? `<p style="margin:0 0 8px">Следующее списание: <strong>${new Date(plan_expires_at).toLocaleDateString('ru-RU')}</strong></p>`
    : '';

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
          ${expiresLine}
          <p style="margin:0 0 24px;font-size:13px;color:#8a7f76;font-family:'IBM Plex Mono',monospace;">Транзакция: ${transaction_id}</p>
          <hr style="border:none;border-top:1px solid #e8e3dc;margin:0 0 24px">
          <p style="margin:0 0 16px;font-size:14px;color:#5a5249;line-height:1.65;">
            Если у вас есть вопросы — напишите на{' '}
            <a href="mailto:frfrancuz@gmail.com" style="color:#a0522d;">frfrancuz@gmail.com</a>.
            Возврат в течение 14 дней по условиям{' '}
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

function buildEmailText(payload: PaymentConfirmationPayload): string {
  const { transaction_id, amount, plan, plan_expires_at } = payload;
  const label = planLabel(plan);
  const expiresLine = plan_expires_at
    ? `Следующее списание: ${new Date(plan_expires_at).toLocaleDateString('ru-RU')}\n`
    : '';
  return `АВТОРСКАЯ СТУДИЯ — Подтверждение оплаты

Тариф: ${label}
Сумма: ${amount} ₽
${expiresLine}Транзакция: ${transaction_id}

По вопросам: frfrancuz@gmail.com
Условия возврата: avtorstudio.com/offer
`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const emailFrom = Deno.env.get('EMAIL_FROM') ?? 'Авторская студия <noreply@avtorstudio.com>';

  if (!resendKey) return json(500, { error: 'RESEND_API_KEY secret is not set' });

  let payload: PaymentConfirmationPayload;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: 'invalid json' });
  }

  const { user_email, transaction_id, amount, plan } = payload;
  if (!user_email || !transaction_id || !amount || !plan) {
    return json(400, { error: 'missing required fields: user_email, transaction_id, amount, plan' });
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [user_email],
      subject: `Оплата подтверждена — ${planLabel(plan)}`,
      html: buildEmailHtml(payload),
      text: buildEmailText(payload),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return json(502, { error: `resend error: ${err}` });
  }

  const data = await res.json();
  return json(200, { ok: true, email_id: data.id });
});
