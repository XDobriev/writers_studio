import { describe, expect, it } from 'vitest';
import { retryDecision } from '../../supabase/functions/_shared/billingRetry.ts';

// Повтор рекуррентного списания (billing-scheduler): двойное списание хуже пропущенного дня.
describe('retryDecision', () => {
  it('статус неизвестен — откладываем, не списываем', () => {
    expect(retryDecision(null)).toBe('postpone');
  });

  it('прошлый счёт оплачен — не списываем, это потерянный webhook', () => {
    expect(retryDecision({ resultCode: 0, stateCode: 100 })).toBe('paid');
  });

  it.each([5, 50, 80])('прошлый счёт в обработке (State %i) — не списываем', (stateCode) => {
    expect(retryDecision({ resultCode: 0, stateCode })).toBe('in_flight');
  });

  it('прошлый счёт отменён (State 10) — можно списывать', () => {
    expect(retryDecision({ resultCode: 0, stateCode: 10 })).toBe('charge');
  });

  it('операции нет у Робокассы (Result ≠ 0) — можно списывать', () => {
    expect(retryDecision({ resultCode: 3, stateCode: null })).toBe('charge');
  });
});
