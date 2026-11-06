// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

const mockStartLogin = vi.fn();
let mockVkBusy = false;
let mockVkError: string | null = null;

vi.mock('../lib/useVkAuth', () => ({
  useVkAuth: () => ({
    startLogin: mockStartLogin,
    busy: mockVkBusy,
    error: mockVkError,
    clearError: vi.fn(),
  }),
}));

vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    signIn: vi.fn(),
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn(),
  }),
  translateAuthError: (s: string) => s,
}));

vi.mock('../lib/queries', () => ({
  useRegistrationOpen: () => ({ data: true }),
}));

import { AuthForm } from './AuthForm';

let root: Root;
let container: HTMLDivElement;

const fakeTgAuth = {
  tgSlotRef: { current: null },
  busy: false,
  error: null,
  clearError: vi.fn(),
};

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mockStartLogin.mockReset();
  mockVkBusy = false;
  mockVkError = null;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderForm(initialEntry = '/login') {
  act(() => {
    root.render(
      createElement(
        MemoryRouter,
        { initialEntries: [initialEntry] },
        createElement(AuthForm, { telegramAuth: fakeTgAuth })
      )
    );
  });
}

describe('AuthForm with VK ID button', () => {
  it('always renders the VK ID button on the signin tab', () => {
    renderForm('/login');
    const buttons = Array.from(container.querySelectorAll('button'));
    const vkBtn = buttons.find((b) => b.textContent?.includes('Войти через VK ID'));
    expect(vkBtn).toBeDefined();
    expect(vkBtn?.disabled).toBe(false);
  });

  it('calls startLogin when clicking the VK ID button', async () => {
    renderForm('/login');
    const buttons = Array.from(container.querySelectorAll('button'));
    const vkBtn = buttons.find((b) => b.textContent?.includes('Войти через VK ID'));
    expect(vkBtn).toBeDefined();

    await act(async () => {
      vkBtn?.click();
    });

    expect(mockStartLogin).toHaveBeenCalledTimes(1);
  });

  it('disables the VK button on signup tab if consent is not given', () => {
    renderForm('/login?tab=signup');
    const buttons = Array.from(container.querySelectorAll('button'));
    const vkBtn = buttons.find((b) => b.textContent?.includes('Зарегистрироваться через VK ID'));
    expect(vkBtn).toBeDefined();
    expect(vkBtn?.disabled).toBe(true);
  });

  it('shows connecting state when VK auth is busy', () => {
    mockVkBusy = true;
    renderForm('/login');
    const buttons = Array.from(container.querySelectorAll('button'));
    const vkBtn = buttons.find((b) => b.textContent?.includes('Подключение VK…'));
    expect(vkBtn).toBeDefined();
    expect(vkBtn?.disabled).toBe(true);
  });
});
