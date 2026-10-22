import { supabase } from './supabase';

export type CheckoutPlan = 'pro' | 'pro_annual' | 'lifetime';

/** Ключ sessionStorage: согласие на рекуррент, данное на лендинге до регистрации (значение = план). */
export const PENDING_CONSENT_KEY = 'pending_recurring_consent';

export function isCheckoutPlan(value: unknown): value is CheckoutPlan {
  return value === 'pro' || value === 'pro_annual' || value === 'lifetime';
}

/** Pro (месяц/год) — подписка с автопродлением: перед оплатой обязателен чекбокс согласия. */
export function isRecurringPlan(plan: CheckoutPlan): plan is 'pro' | 'pro_annual' {
  return plan === 'pro' || plan === 'pro_annual';
}

const MESSAGES: Record<string, string> = {
  already_lifetime: 'У вас уже Lifetime — подписка не нужна.',
  already_pro: 'Подписка Pro уже активна.',
  lifetime_sold_out: 'Места Lifetime закончились.',
  payments_disabled: 'Оплата временно недоступна. Попробуйте позже.',
  consent_required: 'Подтвердите согласие на автоматические списания.',
};

export class CheckoutError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'CheckoutError';
  }
}

async function errorCode(error: unknown): Promise<string> {
  if (typeof error !== 'object' || error === null || !('context' in error)) return 'unknown';
  const ctx = error.context;
  if (!(ctx instanceof Response)) return 'unknown';
  try {
    const body: unknown = await ctx.json();
    if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') return body.error;
  } catch { /* не JSON */ }
  return 'unknown';
}

/**
 * Ссылка оплаты Робокассы. consent — пользователь отметил согласие на автоматические
 * списания; сервер сам записывает его в recurring_consents (IP, UA, версия текста).
 * Без согласия Pro-подписка не оформляется (400 consent_required).
 */
export async function startCheckout(plan: CheckoutPlan, consent: boolean): Promise<string> {
  const { data, error } = await supabase.functions.invoke('create-payment-url', {
    body: { plan, consent },
  });
  if (error) {
    const code = await errorCode(error);
    throw new CheckoutError(code, MESSAGES[code] ?? 'Не удалось перейти к оплате. Попробуйте ещё раз.');
  }
  const url: unknown = typeof data === 'object' && data !== null && 'url' in data ? data.url : null;
  if (typeof url !== 'string') throw new CheckoutError('no_url', 'Не удалось получить ссылку на оплату.');
  return url;
}
