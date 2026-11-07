// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

const mockVerifyOtp = vi.fn();
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockUpdatePassword = vi.fn();
const mockSignOut = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  },
}));

vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    updatePassword: (...args: unknown[]) => mockUpdatePassword(...args),
  }),
  translateAuthError: (e: unknown) => String(e),
}));

import ResetPassword from './ResetPassword';

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mockVerifyOtp.mockReset();
  mockGetSession.mockReset().mockResolvedValue({ data: { session: null } });
  mockOnAuthStateChange.mockReset().mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
  mockUpdatePassword.mockReset();
  mockSignOut.mockReset().mockResolvedValue({});
  window.history.pushState({}, '', '/reset-password');
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe('ResetPassword', () => {
  it('calls verifyOtp when token_hash is in URL and switches to ready on success', async () => {
    mockVerifyOtp.mockResolvedValueOnce({ data: { user: {}, session: {} }, error: null });
    window.history.pushState({}, '', '/reset-password?token_hash=test_hash_123');

    await act(async () => {
      root.render(
        createElement(MemoryRouter, null, createElement(ResetPassword))
      );
    });

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      token_hash: 'test_hash_123',
      type: 'recovery',
    });

    expect(container.textContent).toContain('Новый пароль');
  });

  it('switches to ready when active session is already detected', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: '1' } } } });

    await act(async () => {
      root.render(
        createElement(MemoryRouter, null, createElement(ResetPassword))
      );
    });

    expect(container.textContent).toContain('Новый пароль');
  });

  it('shows expired message when verifyOtp fails', async () => {
    mockVerifyOtp.mockResolvedValueOnce({ data: { user: null, session: null }, error: new Error('Token expired') });
    window.history.pushState({}, '', '/reset-password?token_hash=expired_hash');

    await act(async () => {
      root.render(
        createElement(MemoryRouter, null, createElement(ResetPassword))
      );
    });

    expect(container.textContent).toContain('Ссылка устарела');
  });
});
