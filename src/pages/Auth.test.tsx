// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    signIn: vi.fn(),
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn(),
  }),
  translateAuthError: (s: string) => s,
}));

vi.mock('../lib/useTelegramAuth', () => ({
  useTelegramAuth: () => ({
    busy: false,
    error: null,
    clearError: vi.fn(),
    tgSlotRef: { current: null },
  }),
  TG_BOT_USERNAME: 'test_bot',
}));

vi.mock('../lib/useVkAuth', () => ({
  useVkAuth: () => ({
    startLogin: vi.fn(),
    busy: false,
    error: null,
    clearError: vi.fn(),
  }),
}));

vi.mock('../lib/queries', () => ({
  useRegistrationOpen: () => ({ data: true }),
}));

vi.mock('../lib/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false, isTablet: false, isDesktop: true }),
  useMediaQuery: () => false,
}));

import Auth from './Auth';

let root: Root | null = null;
let queryClient: QueryClient;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-theme');
  vi.clearAllMocks();
});

function mount() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  act(() => {
    root!.render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(MemoryRouter, { initialEntries: ['/login'] }, createElement(Auth)),
      ),
    );
  });
  return container;
}

describe('Auth page (тема)', () => {
  it('отображает кнопку переключения темы и переключает тёмную/светлую тему', () => {
    const container = mount();
    const themeBtn = container.querySelector('button[aria-label="Переключить на светлую тему"]') as HTMLButtonElement;
    expect(themeBtn).not.toBeNull();

    // Кликаем для переключения на светлую тему
    act(() => {
      themeBtn.click();
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(themeBtn.getAttribute('aria-label')).toBe('Переключить на тёмную тему');

    // Кликаем для возврата к тёмной теме
    act(() => {
      themeBtn.click();
    });

    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
    expect(themeBtn.getAttribute('aria-label')).toBe('Переключить на светлую тему');
  });
});
