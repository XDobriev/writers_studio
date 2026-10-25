// Уведомление владельцу в Telegram (тот же бот и чат, что у new-user-notify).
// Best-effort: сбой отправки не должен ломать вызывающую функцию.

export async function notifyOwner(text: string): Promise<boolean> {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const chatId = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID');
  if (!botToken || !chatId) {
    console.warn('[notifyOwner] telegram secrets are not set');
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) console.warn('[notifyOwner] sendMessage status', res.status);
    return res.ok;
  } catch (e) {
    console.warn('[notifyOwner] sendMessage failed:', e instanceof Error ? e.message : String(e));
    return false;
  }
}
