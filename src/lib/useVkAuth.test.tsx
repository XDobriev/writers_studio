// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const mockSignInWithVk = vi.fn();
vi.mock('./auth', () => ({
  useAuth: () => ({ signInWithVk: mockSignInWithVk }),
  translateAuthError: (s: string) => s,
}));

const mockConfigInit = vi.fn();
const mockAuthLogin = vi.fn();
const mockAuthExchangeCode = vi.fn();

vi.mock('@vkid/sdk', () => ({
  Config: {
    init: (...args: unknown[]) => mockConfigInit(...args),
  },
  Auth: {
    login: (...args: unknown[]) => mockAuthLogin(...args),
    exchangeCode: (...args: unknown[]) => mockAuthExchangeCode(...args),
  },
  ConfigAuthMode: { InNewWindow: 'new_window' },
  ConfigResponseMode: { Callback: 'callback' },
  ConfigSource: { LOWCODE: 'lowcode' },
  AuthErrorCode: {
    CannotCreateNewTab: 101,
    NewTabHasBeenClosed: 102,
    AuthorizationFailed: 103,
  },
}));

import { useVkAuth } from './useVkAuth';

let root: Root;
let container: HTMLDivElement;
let hookResult: ReturnType<typeof useVkAuth>;

beforeEach(async () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mockSignInWithVk.mockReset().mockResolvedValue({ error: null });
  mockConfigInit.mockReset();
  mockAuthLogin.mockReset();
  mockAuthExchangeCode.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderHook() {
  function Probe() {
    hookResult = useVkAuth();
    return null;
  }
  act(() => root.render(createElement(Probe)));
}

describe('useVkAuth', () => {
  it('successfully logs in via VK ID popup and exchanges code', async () => {
    mockAuthLogin.mockResolvedValue({ code: 'test_code', device_id: 'test_device' });
    mockAuthExchangeCode.mockResolvedValue({ access_token: 'test_token', user_id: 99999 });

    renderHook();
    expect(hookResult.busy).toBe(false);
    expect(hookResult.error).toBeNull();

    await act(async () => {
      await hookResult.startLogin();
    });

    expect(mockConfigInit).toHaveBeenCalledWith(
      expect.objectContaining({
        app: expect.any(Number),
        mode: 'new_window',
        responseMode: 'callback',
      })
    );
    expect(mockAuthLogin).toHaveBeenCalled();
    expect(mockAuthExchangeCode).toHaveBeenCalledWith('test_code', 'test_device');
    expect(mockSignInWithVk).toHaveBeenCalledWith('test_token', 99999);
    expect(hookResult.busy).toBe(false);
    expect(hookResult.error).toBeNull();
  });

  it('handles user closing the popup window gracefully without error', async () => {
    mockAuthLogin.mockRejectedValue({ code: 102 }); // NewTabHasBeenClosed

    renderHook();
    await act(async () => {
      await hookResult.startLogin();
    });

    expect(hookResult.busy).toBe(false);
    expect(hookResult.error).toBeNull();
    expect(mockSignInWithVk).not.toHaveBeenCalled();
  });

  it('shows browser popup blocked error if popup window could not be opened', async () => {
    mockAuthLogin.mockRejectedValue({ code: 101 }); // CannotCreateNewTab

    renderHook();
    await act(async () => {
      await hookResult.startLogin();
    });

    expect(hookResult.busy).toBe(false);
    expect(hookResult.error).toContain('Всплывающее окно заблокировано');
    expect(mockSignInWithVk).not.toHaveBeenCalled();
  });

  it('handles backend authentication error', async () => {
    mockAuthLogin.mockResolvedValue({ code: 'test_code', device_id: 'test_device' });
    mockAuthExchangeCode.mockResolvedValue({ access_token: 'test_token', user_id: 99999 });
    mockSignInWithVk.mockResolvedValue({ error: 'invalid token' });

    renderHook();
    await act(async () => {
      await hookResult.startLogin();
    });

    expect(hookResult.busy).toBe(false);
    expect(hookResult.error).toContain('VK: invalid token');
  });
});
