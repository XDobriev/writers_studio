import * as Sentry from './monitoring';
import { translateAuthError } from './auth';

// Текст ошибки для пользователя. Сырые сообщения Postgres/PostgREST/fetch
// («[books] new row violates row-level security policy», «Failed to fetch»)
// в интерфейс не попадают — вместо них понятная фраза, а оригинал уходит в Sentry.

const NETWORK = /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_network|timeout/i;
const FALLBACK = 'Не удалось выполнить действие. Попробуйте ещё раз.';

function rawMessage(err: unknown): { message: string; code?: string } {
  if (typeof err === 'string') return { message: err };
  if (err && typeof err === 'object') {
    const o = err as { message?: unknown; code?: unknown };
    return {
      message: typeof o.message === 'string' ? o.message : '',
      code: typeof o.code === 'string' ? o.code : undefined,
    };
  }
  return { message: '' };
}

export function toUserMessage(err: unknown, fallback = FALLBACK): string {
  const { message, code } = rawMessage(err);
  const translatedAuth = translateAuthError(message);
  if (translatedAuth !== message) return translatedAuth;

  if (NETWORK.test(message) || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return 'Нет соединения с сервером. Проверьте интернет и повторите.';
  }
  if (message.includes('plan_limit')) return 'Достигнут лимит бесплатного тарифа. Перейдите на Pro, чтобы продолжить.';
  if (code === 'PGRST301' || /jwt expired|invalid jwt|session/i.test(message)) {
    return 'Сессия истекла. Обновите страницу и войдите снова.';
  }
  if (code === '42501' || /row-level security|permission denied/i.test(message)) {
    return 'Нет доступа к этим данным. Обновите страницу — возможно, вы вошли в другой аккаунт.';
  }
  if (code === '23505' || /duplicate key/i.test(message)) return 'Такая запись уже существует.';
  if (code === 'PGRST116' || /0 rows|not found/i.test(message)) return 'Запись не найдена — возможно, её уже удалили.';

  // Сообщение уже на русском и без технического префикса — показываем как есть.
  if (message && /[а-яё]/i.test(message) && !message.startsWith('[')) return message;

  if (message) Sentry.captureMessage(`user-facing error: ${message}`, { level: 'warning', extra: { code } });
  return fallback;
}
