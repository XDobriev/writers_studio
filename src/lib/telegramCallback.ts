import { isTelegramAuthData, TELEGRAM_AUTH_FIELDS, type TelegramAuthData } from '../../supabase/functions/_shared/telegramAuth';

const STATE_KEY = 'telegram_login_state';
type Callback = { data: TelegramAuthData; error: null } | { data: null; error: string };
let pendingCallback: Callback | null = null;

export function createTelegramAuthUrl(): string {
  const url = new URL('/login', window.location.origin);
  const params = new URLSearchParams(window.location.search);
  for (const key of ['tab', 'plan']) {
    const value = params.get(key);
    if (value) url.searchParams.set(key, value);
  }
  const state = crypto.randomUUID();
  sessionStorage.setItem(STATE_KEY, state);
  url.searchParams.set('tg_state', state);
  return url.href;
}

// Called before monitoring and analytics can observe the URL.
export function captureTelegramCallback(): void {
  const url = new URL(window.location.href);
  const params = new URLSearchParams(url.search);
  const hasFragment = url.hash.includes('tgAuthResult=');
  const fragment = url.hash.match(/[#?&]tgAuthResult=([A-Za-z0-9_=-]*)$/)?.[1];
  if (url.pathname !== '/login' || (!hasFragment && !['tg_state', 'hash', 'auth_date'].some((key) => params.has(key)))) return;
  for (const key of [...TELEGRAM_AUTH_FIELDS, 'tg_state']) url.searchParams.delete(key);
  if (hasFragment) url.hash = '';
  window.history.replaceState(window.history.state, '', url);

  pendingCallback = { data: null, error: 'Не удалось подтвердить вход через Telegram. Попробуйте ещё раз в этой вкладке.' };
  try {
    const expectedState = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    if (!expectedState || params.get('tg_state') !== expectedState
      || [...TELEGRAM_AUTH_FIELDS, 'tg_state'].some((key) => params.getAll(key).length > 1)) return;
    const queryFields = TELEGRAM_AUTH_FIELDS.filter((key) => params.has(key));
    if (!hasFragment && queryFields.length === 0) { pendingCallback = null; return; }
    let data: unknown;
    if (hasFragment) {
      if (!fragment || queryFields.length > 0) return;
      const binary = atob(fragment.replace(/-/g, '+').replace(/_/g, '/'));
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } else {
      data = Object.fromEntries(queryFields.map((key) => [key, params.get(key)]));
    }
    if (isTelegramAuthData(data)) pendingCallback = { data, error: null };
  } catch { /* Unavailable storage or malformed fragment: fail closed. */ }
}

export function takeTelegramCallback(): Callback | null {
  const callback = pendingCallback;
  pendingCallback = null;
  return callback;
}

export function hasTelegramCallback(): boolean {
  return pendingCallback !== null;
}
