// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

let mockProfile: any = null;
const mockStartProTrial = vi.fn();
const mockSetQueryData = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock('../lib/auth', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

vi.mock('../lib/queries', () => ({
  useProfile: () => ({ data: mockProfile }),
  QUERY_KEYS: { profile: (id: string) => ['profile', id] },
}));

vi.mock('../lib/profiles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/profiles')>();
  return {
    ...actual,
    startProTrial: () => mockStartProTrial(),
  };
});

vi.mock('./UpgradeModal', () => ({
  UpgradeModal: () => createElement('div', { 'data-testid': 'upgrade-modal' }),
}));

import { UpgradePrompt } from './UpgradePrompt';

let root: Root | null = null;

function mount(props: {
  open: boolean;
  feature: string;
  onClose?: () => void;
  onTrialActivated?: () => void;
}): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => {
    root!.render(
      createElement(UpgradePrompt, {
        open: props.open,
        feature: props.feature,
        onClose: props.onClose ?? vi.fn(),
        onTrialActivated: props.onTrialActivated,
      }),
    );
  });
  return el;
}

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    setQueryData: mockSetQueryData,
    invalidateQueries: mockInvalidateQueries,
  }),
}));

beforeEach(() => {
  mockProfile = {
    user_id: 'u1',
    plan: 'free',
    plan_expires_at: null,
    trial_started_at: null,
    trial_ends_at: null,
    trial_used: false,
  };
  mockStartProTrial.mockReset();
  mockSetQueryData.mockReset();
  mockInvalidateQueries.mockReset();
});

afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('UpgradePrompt', () => {
  it('не рендерит ничего, если open: false', () => {
    const el = mount({ open: false, feature: 'characters' });
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });

  it('рендерит предложение 7-дневного триала для characters, когда trial_used: false', () => {
    const el = mount({ open: true, feature: 'characters' });
    expect(el.querySelector('[role="dialog"]')).not.toBeNull();
    expect(el.textContent).toContain('4-й персонаж — попробуйте Pro бесплатно');
    expect(el.textContent).toContain('Бесплатный план включает до 3 персонажей. Включите 7 дней Pro в один клик');
    expect(el.textContent).toContain('Включить 7 дней Pro бесплатно');
    expect(el.textContent).toContain('Купить Pro');
  });

  it('рендерит предложение 7-дневного триала для timeline, когда trial_used: false', () => {
    const el = mount({ open: true, feature: 'timeline' });
    expect(el.querySelector('[role="dialog"]')).not.toBeNull();
    expect(el.textContent).toContain('11-е событие — попробуйте Pro бесплатно');
    expect(el.textContent).toContain('Бесплатный план включает до 10 событий хронологии. Включите 7 дней Pro в один клик');
    expect(el.textContent).toContain('Включить 7 дней Pro бесплатно');
  });

  it('активирует триал в 1 клик, инвалидирует кэш и вызывает onTrialActivated', async () => {
    const onClose = vi.fn();
    const onTrialActivated = vi.fn();
    const nowIso = new Date().toISOString();
    const endsIso = new Date(Date.now() + 7 * 86400000).toISOString();

    mockStartProTrial.mockResolvedValueOnce({
      trial_started_at: nowIso,
      trial_ends_at: endsIso,
      trial_used: true,
    });

    const el = mount({ open: true, feature: 'characters', onClose, onTrialActivated });
    const trialBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Включить 7 дней Pro бесплатно')
    );
    expect(trialBtn).toBeDefined();

    await act(async () => {
      trialBtn?.click();
    });

    expect(mockStartProTrial).toHaveBeenCalledTimes(1);
    expect(mockSetQueryData).toHaveBeenCalledWith(['profile', 'u1'], expect.any(Function));
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['profile', 'u1'] });
    expect(onClose).toHaveBeenCalled();
    expect(onTrialActivated).toHaveBeenCalledTimes(1);
  });

  it('показывает ошибку, если RPC startProTrial упал', async () => {
    const onClose = vi.fn();
    const onTrialActivated = vi.fn();
    mockStartProTrial.mockRejectedValueOnce(new Error('Сетевой сбой при активации'));

    const el = mount({ open: true, feature: 'characters', onClose, onTrialActivated });
    const trialBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Включить 7 дней Pro бесплатно')
    );

    await act(async () => {
      trialBtn?.click();
    });

    expect(mockStartProTrial).toHaveBeenCalledTimes(1);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Сетевой сбой при активации');
    expect(onClose).not.toHaveBeenCalled();
    expect(onTrialActivated).not.toHaveBeenCalled();
  });

  it('показывает стандартный диалог «Перейти на Pro →», если триал уже использован', () => {
    mockProfile.trial_used = true;
    const el = mount({ open: true, feature: 'characters' });

    expect(el.textContent).toContain('Лимит персонажей');
    expect(el.textContent).toContain('Перейти на Pro →');
    expect(el.textContent).not.toContain('Включить 7 дней Pro бесплатно');
  });

  it('показывает стандартный диалог «Перейти на Pro →» для feature="export"', () => {
    const el = mount({ open: true, feature: 'export' });

    expect(el.textContent).toContain('Экспорт недоступен');
    expect(el.textContent).toContain('Перейти на Pro →');
    expect(el.textContent).not.toContain('Включить 7 дней Pro бесплатно');
  });
});
