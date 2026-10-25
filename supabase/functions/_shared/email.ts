// Отправка писем через Resend.
// Secrets: RESEND_API_KEY (обязателен), EMAIL_FROM (необязателен, "Имя <адрес>").
// Домен отправителя должен быть подтверждён в Resend (SPF/DKIM), иначе письма уйдут только владельцу аккаунта.

const RESEND_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Авторская студия <studio@avtorstudio.com>';

/** Синтетические адреса Telegram/VK (*.local) и пустые — не доставляемы. */
export function isDeliverableEmail(email: string | null | undefined): email is string {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && !e.endsWith('.local');
}

export async function sendEmail(msg: {
  to: string;
  subject: string;
  html: string;
  plaintext: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY is not set' };
  if (!isDeliverableEmail(msg.to)) return { ok: false, error: 'undeliverable address' };
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: Deno.env.get('EMAIL_FROM') || DEFAULT_FROM,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.plaintext,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { name?: string; message?: string };
      return { ok: false, error: `resend ${res.status} ${data.name ?? ''} ${data.message ?? ''}`.trim() };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
