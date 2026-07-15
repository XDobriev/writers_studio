export type BillingInterval = 'monthly' | 'annual';

/** Боевые цены. Должны совпадать с create-payment-url/index.ts и офертой /offer. */
export const PRO_PRICES: Record<'base' | 'grandfathered', Record<BillingInterval, number>> = {
  base:          { monthly: 399, annual: 3490 },
  grandfathered: { monthly: 290, annual: 2900 },
};

export const LIFETIME_PRICE = 4990;

/** Ранняя цена для новых покупателей. Зеркалит Secret GRANDFATHERING_ENDS_AT. */
const GRANDFATHERING_ENDS_AT = '2026-09-01';

export function isGrandfatheringActive(now: Date = new Date()): boolean {
  return now < new Date(GRANDFATHERING_ENDS_AT);
}

export function proPrice(interval: BillingInterval, grandfathered: boolean): number {
  return PRO_PRICES[grandfathered ? 'grandfathered' : 'base'][interval];
}

/** Насколько год дешевле 12 месяцев: 27% по базовой цене, 17% по ранней. */
export function annualSavingsPercent(grandfathered: boolean): number {
  const tier = PRO_PRICES[grandfathered ? 'grandfathered' : 'base'];
  return Math.round((1 - tier.annual / (tier.monthly * 12)) * 100);
}

export function planKeyFor(interval: BillingInterval): 'pro' | 'pro_annual' {
  return interval === 'annual' ? 'pro_annual' : 'pro';
}

export function formatRub(amount: number): string {
  return `${amount.toLocaleString('ru-RU')} ₽`;
}
