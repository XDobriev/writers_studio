// Единая таблица цен edge-функций (create-payment-url, billing-scheduler, robokassa-webhook).
// Чистый модуль без импортов: его же импортирует unit-тест фронта (src/lib/pricing.test.ts),
// который сверяет цены с src/lib/pricing.ts. Меняя цены — править оба файла и оферту /offer.

export type PaidPlan = 'pro' | 'pro_annual' | 'lifetime';
export type BillingInterval = 'monthly' | 'annual';

/** Строки — в формате OutSum Робокассы (два знака после точки). */
export const PRICES: Record<PaidPlan, { base: string; grandfathered: string | null }> = {
  pro:        { base: '399.00',  grandfathered: '290.00' },
  pro_annual: { base: '3490.00', grandfathered: '2900.00' },
  lifetime:   { base: '4990.00', grandfathered: null },
};

export const DESCRIPTIONS: Record<PaidPlan, string> = {
  pro:        'Подписка Pro — Авторская студия',
  pro_annual: 'Подписка Pro (год) — Авторская студия',
  lifetime:   'Lifetime — Авторская студия',
};

export function isPaidPlan(plan: unknown): plan is PaidPlan {
  return plan === 'pro' || plan === 'pro_annual' || plan === 'lifetime';
}

export function planForInterval(interval: BillingInterval): 'pro' | 'pro_annual' {
  return interval === 'annual' ? 'pro_annual' : 'pro';
}

export function priceFor(plan: PaidPlan, grandfathered: boolean): string {
  const row = PRICES[plan];
  return grandfathered && row.grandfathered ? row.grandfathered : row.base;
}

/** Нижняя граница суммы в вебхуке: самая низкая легитимная цена плана. */
export function minPrice(plan: PaidPlan): number {
  const row = PRICES[plan];
  return parseFloat(row.grandfathered ?? row.base);
}

/**
 * Версия и текст согласия на рекуррентные списания, которые сохраняются в
 * recurring_consents. Менять версию при каждой правке текста оферты о продлении.
 */
export const RECURRING_CONSENT_VERSION = '2026-10-22';

export function recurringConsentText(plan: 'pro' | 'pro_annual'): string {
  return plan === 'pro_annual'
    ? 'Согласен на автоматические ежегодные списания согласно условиям оферты'
    : 'Согласен на автоматические ежемесячные списания согласно условиям оферты';
}
