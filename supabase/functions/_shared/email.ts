// Отправка писем через UniSender Go (как в retention-email).
// Secrets: UNISENDER_GO_API_KEY (обязателен), EMAIL_FROM (необязателен, "Имя <адрес>").

const UNISENDER_URL = 'https://goapi.unisender.ru/ru/transactional/api/v1/email/send.json';
const DEFAULT_FROM_NAME = 'Авторская студия';
const DEFAULT_FROM_EMAIL = 'studio@avtorstudio.com';

/** Синтетические адреса Telegram/VK (*.local) и пустые — не доставляемы. */
export function isDeliverableEmail(email: string | null | undefined): email is string {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && !e.endsWith('.local');
}

function sender(): { from_email: string; from_name: string } {
  const raw = Deno.env.get('EMAIL_FROM');
  const m = raw?.match(/^(.+?)\s*<(.+?)>$/);
  return m
    ? { from_name: m[1].trim(), from_email: m[2].trim() }
    : { from_name: DEFAULT_FROM_NAME, from_email: DEFAULT_FROM_EMAIL };
}

export async function sendEmail(msg: {
  to: string;
  subject: string;
  html: string;
  plaintext: string;
  track?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = Deno.env.get('UNISENDER_GO_API_KEY');
  if (!apiKey) return { ok: false, error: 'UNISENDER_GO_API_KEY is not set' };
  if (!isDeliverableEmail(msg.to)) return { ok: false, error: 'undeliverable address' };
  try {
    const res = await fetch(UNISENDER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
      body: JSON.stringify({
        message: {
          ...sender(),
          recipients: [{ email: msg.to }],
          subject: msg.subject,
          body: { html: msg.html, plaintext: msg.plaintext },
          track_links: msg.track ? 1 : 0,
          track_read: msg.track ? 1 : 0,
        },
      }),
    });
    const data = await res.json().catch(() => ({})) as { status?: string; failed_emails?: Record<string, unknown> };
    // UniSender Go может вернуть status:'success', но с адресом в failed_emails.
    if (!res.ok || data.status !== 'success' || (data.failed_emails && data.failed_emails[msg.to])) {
      return { ok: false, error: `unisender status ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
