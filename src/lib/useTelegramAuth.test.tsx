// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { captureTelegramCallback, createTelegramAuthUrl, takeTelegramCallback } from './telegramCallback';

const signIn = vi.fn();
vi.mock('./auth', () => ({ useAuth: () => ({ signInWithTelegram: signIn }), translateAuthError: (s: string) => s }));

let root: Root;
let container: HTMLDivElement;
let api: ReturnType<typeof import('./useTelegramAuth').useTelegramAuth>;
let useTelegramAuth: typeof import('./useTelegramAuth').useTelegramAuth;

beforeEach(async () => {
  vi.stubEnv('VITE_TELEGRAM_BOT_USERNAME', 'test_bot');
  useTelegramAuth = (await import('./useTelegramAuth')).useTelegramAuth;
  container = document.createElement('div');
  root = createRoot(container);
  sessionStorage.clear();
  window.history.replaceState(null, '', '/login');
  takeTelegramCallback();
  signIn.mockReset().mockResolvedValue({ error: null });
});

afterEach(() => { act(() => root.unmount()); vi.unstubAllEnvs(); });

function mount() {
  function Probe() {
    api = useTelegramAuth();
    return createElement('div', { ref: api.tgSlotRef });
  }
  act(() => root.render(createElement(StrictMode, null, createElement(Probe))));
}

function callback() {
  const url = new URL(createTelegramAuthUrl());
  const data = { id: '123', auth_date: String(Math.floor(Date.now() / 1000)), first_name: 'Иван + &', hash: 'a'.repeat(64) };
  for (const [key, value] of Object.entries(data)) url.searchParams.set(key, value);
  window.history.replaceState(null, '', url);
  captureTelegramCallback();
  return data;
}

describe('useTelegramAuth', () => {
  it('mounts redirect-only official widget under StrictMode', () => {
    mount();
    const scripts = container.querySelectorAll('script');
    expect(scripts).toHaveLength(1);
    expect(scripts[0].getAttribute('data-auth-url')).toContain('/login?tg_state=');
    expect(scripts[0].hasAttribute('data-onauth')).toBe(false);
    expect(signIn).not.toHaveBeenCalled();
  });

  it('submits callback once under StrictMode and clears busy', async () => {
    const data = callback();
    mount();
    expect(api.busy).toBe(true);
    await act(async () => {});
    expect(signIn).toHaveBeenCalledExactlyOnceWith(data);
    expect(api.busy).toBe(false);
    expect(api.error).toBeNull();
  });

  it('does not submit a callback without state', () => {
    callback();
    // Re-capture a forged URL, replacing the pending valid callback.
    window.history.replaceState(null, '', '/login?id=123&auth_date=1793743200&hash=' + 'a'.repeat(64));
    captureTelegramCallback();
    mount();
    expect(signIn).not.toHaveBeenCalled();
    expect(api.error).toBeTruthy();
    expect(api.busy).toBe(false);
  });

  it.each(['returned', 'thrown'])('shows %s auth failure and clears busy', async (kind) => {
    callback();
    if (kind === 'thrown') signIn.mockRejectedValue(new Error('offline'));
    else signIn.mockResolvedValue({ error: 'invalid telegram signature' });
    mount();
    await act(async () => {});
    expect(api.busy).toBe(false);
    expect(api.error).toBeTruthy();
  });
});
