import { describe, expect, it } from 'vitest';
import { LIFETIME_PRICE, PRO_PRICES, planKeyFor } from './pricing';
import { PRICES, minPrice, planForInterval, priceFor } from '../../supabase/functions/_shared/pricing.ts';

// Цены фронта (лендинг, UpgradeModal, оферта) и edge-функций (create-payment-url,
// billing-scheduler, нижняя граница в robokassa-webhook) обязаны совпадать.
describe('pricing: фронт = edge', () => {
  it('Pro месяц: базовая и ранняя цена', () => {
    expect(parseFloat(PRICES.pro.base)).toBe(PRO_PRICES.base.monthly);
    expect(parseFloat(PRICES.pro.grandfathered ?? '')).toBe(PRO_PRICES.grandfathered.monthly);
  });

  it('Pro год: базовая и ранняя цена', () => {
    expect(parseFloat(PRICES.pro_annual.base)).toBe(PRO_PRICES.base.annual);
    expect(parseFloat(PRICES.pro_annual.grandfathered ?? '')).toBe(PRO_PRICES.grandfathered.annual);
  });

  it('Lifetime', () => {
    expect(parseFloat(PRICES.lifetime.base)).toBe(LIFETIME_PRICE);
    expect(PRICES.lifetime.grandfathered).toBeNull();
  });

  it('OutSum в формате Робокассы — два знака после точки', () => {
    for (const row of Object.values(PRICES)) {
      expect(row.base).toMatch(/^\d+\.\d{2}$/);
      if (row.grandfathered) expect(row.grandfathered).toMatch(/^\d+\.\d{2}$/);
    }
  });

  it('интервал → план совпадает на фронте и в edge', () => {
    expect(planForInterval('monthly')).toBe(planKeyFor('monthly'));
    expect(planForInterval('annual')).toBe(planKeyFor('annual'));
  });

  it('priceFor и minPrice', () => {
    expect(priceFor('pro', false)).toBe('399.00');
    expect(priceFor('pro', true)).toBe('290.00');
    expect(priceFor('lifetime', true)).toBe('4990.00');
    expect(minPrice('pro')).toBe(290);
    expect(minPrice('pro_annual')).toBe(2900);
    expect(minPrice('lifetime')).toBe(4990);
  });
});
