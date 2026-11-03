// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { captureTelegramCallback, createTelegramAuthUrl, takeTelegramCallback } from './telegramCallback';

const fields = {
  id: '123456789', first_name: 'Иван + & =', last_name: '', username: 'writer',
  photo_url: 'https://t.me/i/a?x=1&y=2', auth_date: '1793743200', hash: 'a'.repeat(64),
};

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState(null, '', '/login?tab=signup&plan=pro');
  takeTelegramCallback();
});

function returnFromTelegram(changes: Partial<Record<keyof typeof fields, string>> = {}) {
  const url = new URL(createTelegramAuthUrl());
  for (const [key, value] of Object.entries({ ...fields, ...changes })) url.searchParams.set(key, value);
  window.history.replaceState({ from: '/books' }, '', url);
  return url;
}

describe('Telegram redirect callback', () => {
  it('uses a fresh same-origin state and preserves checkout/tab', () => {
    const first = new URL(createTelegramAuthUrl());
    const second = new URL(createTelegramAuthUrl());
    expect(second.origin + second.pathname).toBe(window.location.origin + '/login');
    expect(second.searchParams.get('tg_state')).toMatch(/^[\da-f-]{36}$/);
    expect(second.searchParams.get('tg_state')).not.toBe(first.searchParams.get('tg_state'));
    expect(second.searchParams.get('plan')).toBe('pro');
    expect(second.searchParams.get('tab')).toBe('signup');
    expect(window.location.search).not.toContain('tg_state');
  });

  it('decodes once, keeps signed strings exact, strips credentials, consumes once', () => {
    const url = returnFromTelegram();
    captureTelegramCallback();
    expect(window.location.search).toBe('?tab=signup&plan=pro');
    expect(window.history.state).toEqual({ from: '/books' });
    expect(takeTelegramCallback()).toEqual({ data: fields, error: null });
    expect(takeTelegramCallback()).toBeNull();
    window.history.replaceState(null, '', url);
    captureTelegramCallback();
    expect(takeTelegramCallback()?.error).toBeTruthy();
  });

  it.each(['missing', 'mismatch'])('rejects %s state before authentication', (kind) => {
    const url = returnFromTelegram();
    if (kind === 'missing') sessionStorage.clear();
    else url.searchParams.set('tg_state', 'attacker');
    window.history.replaceState(null, '', url);
    captureTelegramCallback();
    expect(takeTelegramCallback()).toEqual({ data: null, error: expect.any(String) });
    expect(window.location.search).toBe('?tab=signup&plan=pro');
  });

  it.each(['id', 'hash', 'auth_date', 'first_name', 'tg_state'])('rejects duplicate %s', (field) => {
    const url = returnFromTelegram();
    url.searchParams.append(field, url.searchParams.get(field) ?? '');
    window.history.replaceState(null, '', url);
    captureTelegramCallback();
    expect(takeTelegramCallback()?.error).toBeTruthy();
  });

  it.each([{ id: '1e3' }, { auth_date: 'NaN' }, { hash: 'bad' }])('rejects malformed fields: %j', (change) => {
    returnFromTelegram(change);
    captureTelegramCallback();
    expect(takeTelegramCallback()?.error).toBeTruthy();
  });

  it('rejects partial callback and leaves an ordinary login alone', () => {
    captureTelegramCallback();
    expect(takeTelegramCallback()).toBeNull();
    const url = returnFromTelegram();
    url.searchParams.delete('hash');
    window.history.replaceState(null, '', url);
    captureTelegramCallback();
    expect(takeTelegramCallback()?.error).toBeTruthy();
  });

  it('rejects tgAuthResult fragments without the original state, before the widget can replay them', () => {
    const url = new URL(createTelegramAuthUrl());
    url.searchParams.delete('tg_state');
    url.hash = 'tgAuthResult=' + btoa(JSON.stringify({ id: 123, auth_date: 1793743200, hash: 'a'.repeat(64) }));
    window.history.replaceState(null, '', url);
    captureTelegramCallback();
    expect(window.location.hash).toBe('');
    expect(takeTelegramCallback()?.error).toBeTruthy();
  });

  it('accepts mobile tgAuthResult only with the original return_to state', () => {
    const url = new URL(createTelegramAuthUrl());
    const data = { id: 123, first_name: 'Иван + &', auth_date: 1793743200, hash: 'a'.repeat(64) };
    const encoded = Array.from(new TextEncoder().encode(JSON.stringify(data)), (byte) => String.fromCharCode(byte)).join('');
    url.hash = 'tgAuthResult=' + btoa(encoded).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    window.history.replaceState(null, '', url);
    captureTelegramCallback();
    expect(window.location.hash).toBe('');
    expect(takeTelegramCallback()).toEqual({ data, error: null });
  });
});
