import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({ supabase: {} }));

import { effectivePlan, getPlanLimits, isPaidPlan, isPlanLimitError, isRenewalFailed } from './profiles';

const NOW = new Date('2026-10-22T12:00:00Z');
const p = (plan: string, plan_expires_at: string | null) => ({ plan, plan_expires_at });

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
