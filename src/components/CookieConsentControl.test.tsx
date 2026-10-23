// @vitest-environment jsdom
// React 18: поддержка act() вне testing-library.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const { consent, setConsent } = vi.hoisted(() => ({
  consent: { value: null as 'accepted' | 'rejected' | null },
  setConsent: vi.fn(),
}));
vi.mock('../lib/analytics', () => ({ getConsent: () => consent.value, setConsent }));

import { CookieConsentControl } from './CookieConsentControl';

let root: Root | null = null;
function mount(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root!.render(createElement(CookieConsentControl)));
  return el;
}
afterEach(() => { act(() => root?.unmount()); setConsent.mockReset(); document.body.innerHTML = ''; });

describe('CookieConsentControl', () => {
  it('согласие дано → «Отозвать согласие» отзывает', () => {
    consent.value = 'accepted';
    const el = mount();
    expect(el.textContent).toContain('Метрика включена');
    act(() => el.querySelector('button')!.click());
    expect(setConsent).toHaveBeenCalledWith('rejected');
    expect(el.textContent).toContain('Метрика отключена');
  });

  it('выбор не сделан → можно разрешить', () => {
    consent.value = null;
    const el = mount();
    expect(el.textContent).toContain('выбор не сделан');
    act(() => el.querySelector('button')!.click());
    expect(setConsent).toHaveBeenCalledWith('accepted');
    expect(el.querySelector('button')!.textContent).toBe('Отозвать согласие');
  });
});
