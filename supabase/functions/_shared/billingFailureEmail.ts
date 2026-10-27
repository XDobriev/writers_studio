// Письмо «не удалось продлить Pro» (G-6): после первой неудачной попытки автосписания
// за период. Отправляет billing-scheduler, один раз на plan_expires_at
// (claim_billing_failure_notice). Чистый модуль — тестируется из src/lib.
import { escapeHtml } from './crypto.ts';

/** Дней после окончания периода до понижения (downgrade_expired_subscriptions, p_grace). */
export const GRACE_DAYS = 3;

function fmtDate(d: Date): string {
  return d.toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' });
}

export function billingFailureEmail(planExpiresAt: string): { subject: string; html: string; plaintext: string } {
  const lapse = new Date(new Date(planExpiresAt).getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000);
  const lines = [
    'Не получилось списать оплату за следующий период подписки Pro: банк отклонил платёж. Так бывает, если на карте не хватило денег, карта истекла или её перевыпустили.',
    'Мы попробуем списать ещё раз в ближайшие дни. Если карта сменилась, оплатите подписку новой картой в «Настройки → Подписка» — автопродление перейдёт на неё.',
    `Если оплата так и не пройдёт, ${fmtDate(lapse)} подписка перейдёт на бесплатный план. Книги и всё написанное сохранятся.`,
  ];
  return {
    subject: 'Не удалось продлить подписку Pro',
    html: `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"></head>
<body style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px 20px;color:#1a1a1a;background:#fff;">
  ${lines.map((l) => `<p style="margin:0 0 20px;font-size:16px;line-height:1.6;">${escapeHtml(l)}</p>`).join('\n  ')}
  <p style="margin:0 0 20px;"><a href="https://avtorstudio.com/books" style="color:#a0522d;">Открыть студию</a></p>
  <p style="margin:0;font-size:13px;color:#666;">Вопросы — support@avtorstudio.com. Условия — avtorstudio.com/offer</p>
</body></html>`,
    plaintext: [...lines, '', 'Открыть студию: https://avtorstudio.com/books', 'Вопросы: support@avtorstudio.com'].join('\n'),
  };
}
