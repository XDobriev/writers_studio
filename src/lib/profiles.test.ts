import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({ supabase: {} }));

import {
  canStartTrial,
  effectivePlan,
  getPlanLimits,
  hasPaidSubscription,
  isPaidPlan,
  isPlanLimitError,
  isRenewalFailed,
  isTrialActive,
} from './profiles';

const NOW = new Date('2026-10-22T12:00:00Z');
const PAST = '2026-10-20T00:00:00Z';
const FUTURE = '2026-10-29T12:00:00Z';
const p = (plan: string, plan_expires_at: string | null, extra?: { trial_started_at?: string | null; trial_ends_at?: string | null; trial_used?: boolean }) => ({
  plan,
  plan_expires_at,
  ...extra,
});

describe('hasPaidSubscription', () => {
  it('lifetime — всегда истинно', () => {
    expect(hasPaidSubscription(p('lifetime', null), NOW)).toBe(true);
    expect(hasPaidSubscription(p('lifetime', PAST), NOW)).toBe(true);
  });

  it('pro — пока срок в будущем или бессрочно', () => {
    expect(hasPaidSubscription(p('pro', FUTURE), NOW)).toBe(true);
    expect(hasPaidSubscription(p('pro', null), NOW)).toBe(true);
    expect(hasPaidSubscription(p('pro', PAST), NOW)).toBe(false);
  });

  it('активный триал или free — НЕ считается оплаченной подпиской', () => {
    expect(hasPaidSubscription(p('free', null, { trial_ends_at: FUTURE }), NOW)).toBe(false);
    expect(hasPaidSubscription(p('free', null), NOW)).toBe(false);
    expect(hasPaidSubscription(null, NOW)).toBe(false);
    expect(hasPaidSubscription(undefined, NOW)).toBe(false);
  });
});

describe('isTrialActive', () => {
  it('активен, если trial_ends_at в будущем и нет платной подписки', () => {
    expect(isTrialActive(p('free', null, { trial_ends_at: FUTURE }), NOW)).toBe(true);
  });

  it('не активен, если trial_ends_at в прошлом или отсутствует', () => {
    expect(isTrialActive(p('free', null, { trial_ends_at: PAST }), NOW)).toBe(false);
    expect(isTrialActive(p('free', null), NOW)).toBe(false);
    expect(isTrialActive(null, NOW)).toBe(false);
  });

  it('не активен, если у пользователя уже есть оплаченный тариф', () => {
    expect(isTrialActive(p('pro', FUTURE, { trial_ends_at: FUTURE }), NOW)).toBe(false);
    expect(isTrialActive(p('lifetime', null, { trial_ends_at: FUTURE }), NOW)).toBe(false);
  });
});

describe('canStartTrial', () => {
  it('разрешено для нового Free-аккаунта без истории триала', () => {
    expect(canStartTrial(p('free', null, { trial_used: false, trial_started_at: null }), NOW)).toBe(true);
  });

  it('запрещено, если триал уже использован или запущен', () => {
    expect(canStartTrial(p('free', null, { trial_used: true }), NOW)).toBe(false);
    expect(canStartTrial(p('free', null, { trial_started_at: PAST }), NOW)).toBe(false);
  });

  it('запрещено, если активен платный тариф или триал', () => {
    expect(canStartTrial(p('pro', FUTURE), NOW)).toBe(false);
    expect(canStartTrial(p('lifetime', null), NOW)).toBe(false);
    expect(canStartTrial(p('free', null, { trial_ends_at: FUTURE }), NOW)).toBe(false);
  });

  it('запрещено при отсутствии профиля', () => {
    expect(canStartTrial(null, NOW)).toBe(false);
    expect(canStartTrial(undefined, NOW)).toBe(false);
  });
});

describe('isPaidPlan', () => {
  it('lifetime — всегда', () => {
    expect(isPaidPlan(p('lifetime', null), NOW)).toBe(true);
    expect(isPaidPlan(p('lifetime', '2020-01-01T00:00:00Z'), NOW)).toBe(true);
  });

  it('pro — пока срок в будущем', () => {
    expect(isPaidPlan(p('pro', '2026-10-23T00:00:00Z'), NOW)).toBe(true);
    expect(isPaidPlan(p('pro', '2026-10-22T11:59:59Z'), NOW)).toBe(false);
  });

  it('pro без срока — бессрочный грант', () => {
    expect(isPaidPlan(p('pro', null), NOW)).toBe(true);
  });

  it('активный 7-дневный триал — считается оплаченным до окончания', () => {
    expect(isPaidPlan(p('free', null, { trial_ends_at: FUTURE }), NOW)).toBe(true);
    expect(isPaidPlan(p('free', null, { trial_ends_at: PAST, trial_used: true }), NOW)).toBe(false);
  });

  it('free, пустой и неизвестный план — не оплачен', () => {
    expect(isPaidPlan(p('free', null), NOW)).toBe(false);
    expect(isPaidPlan(null, NOW)).toBe(false);
    expect(isPaidPlan(undefined, NOW)).toBe(false);
    expect(isPaidPlan(p('pro_annual', '2030-01-01T00:00:00Z'), NOW)).toBe(false);
  });
});

describe('effectivePlan / getPlanLimits', () => {
  it('истёкший pro = free', () => {
    expect(effectivePlan(p('pro', '2026-10-01T00:00:00Z'), NOW)).toBe('free');
    expect(effectivePlan(p('pro', '2026-11-01T00:00:00Z'), NOW)).toBe('pro');
    expect(effectivePlan(p('lifetime', null), NOW)).toBe('lifetime');
  });

  it('активный триал даёт effectivePlan = pro и лимиты Pro', () => {
    const trialProfile = p('free', null, { trial_ends_at: FUTURE });
    expect(effectivePlan(trialProfile, NOW)).toBe('pro');
    const limits = getPlanLimits(trialProfile, NOW);
    expect(limits.maxBooks).toBe(Infinity);
    expect(limits.maxCharacters).toBe(Infinity);
    expect(limits.maxTimelineEvents).toBe(Infinity);
    expect(limits.canExportRich).toBe(true);
  });

  it('истёкший триал возвращает на лимиты Free', () => {
    const expiredProfile = p('free', null, { trial_ends_at: PAST, trial_used: true });
    expect(effectivePlan(expiredProfile, NOW)).toBe('free');
    const limits = getPlanLimits(expiredProfile, NOW);
    expect(limits.maxBooks).toBe(1);
    expect(limits.maxCharacters).toBe(3);
    expect(limits.maxTimelineEvents).toBe(10);
    expect(limits.canExportRich).toBe(false);
  });

  it('лимиты Free совпадают с серверными триггерами', () => {
    expect(getPlanLimits(null)).toEqual({ maxBooks: 1, maxCharacters: 3, maxTimelineEvents: 10, canExportRich: false });
    expect(getPlanLimits(p('lifetime', null)).maxBooks).toBe(Infinity);
  });
});

describe('isPlanLimitError', () => {
  it('распознаёт PostgrestError и DbError с P0001 plan_limit', () => {
    expect(isPlanLimitError({ code: 'P0001', message: 'plan_limit' })).toBe(true);
    expect(isPlanLimitError(Object.assign(new Error('[books] plan_limit'), { code: 'P0001' }))).toBe(true);
  });

  it('прочие ошибки — нет', () => {
    expect(isPlanLimitError({ code: 'P0001', message: 'target not empty' })).toBe(false);
    expect(isPlanLimitError({ code: '42501', message: 'plan_limit' })).toBe(false);
    expect(isPlanLimitError(new Error('plan_limit'))).toBe(false);
    expect(isPlanLimitError(null)).toBe(false);
  });
});

describe('isRenewalFailed', () => {
  const f = (plan: string, exp: string | null, inv: string | null, attempts: number) =>
    ({ plan, plan_expires_at: exp, recurring_inv_id: inv, billing_attempts: attempts });
  const PAST = '2026-10-20T00:00:00Z';
  const FUTURE = '2026-11-20T00:00:00Z';

  it('pro истёк, счёт есть, попытки были — да', () => {
    expect(isRenewalFailed(f('pro', PAST, '1', 1), NOW)).toBe(true);
  });
  it('срок ещё не истёк — нет', () => {
    expect(isRenewalFailed(f('pro', FUTURE, '1', 2), NOW)).toBe(false);
  });
  it('попыток не было, нет рекуррента или бессрочный pro — нет', () => {
    expect(isRenewalFailed(f('pro', PAST, '1', 0), NOW)).toBe(false);
    expect(isRenewalFailed(f('pro', PAST, null, 1), NOW)).toBe(false);
    expect(isRenewalFailed(f('pro', null, '1', 1), NOW)).toBe(false);
  });
  it('не pro и отсутствие профиля — нет', () => {
    expect(isRenewalFailed(f('free', PAST, '1', 1), NOW)).toBe(false);
    expect(isRenewalFailed(f('lifetime', PAST, '1', 1), NOW)).toBe(false);
    expect(isRenewalFailed(null, NOW)).toBe(false);
  });
});
