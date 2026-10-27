import { describe, expect, it } from 'vitest';
import { GRACE_DAYS, billingFailureEmail } from '../../supabase/functions/_shared/billingFailureEmail.ts';

describe('billingFailureEmail (G-6)', () => {
  it('дата понижения = окончание периода + grace, по Москве', () => {
    expect(GRACE_DAYS).toBe(3);
    // 31.10 21:30 UTC = 01.11 00:30 МСК → +3 дня = 04.11
    const { plaintext } = billingFailureEmail('2026-10-31T21:30:00Z');
    expect(plaintext).toContain('04.11.2026');
  });

  it('называет, где оплатить новой картой, и что данные сохранятся', () => {
    const { subject, plaintext, html } = billingFailureEmail('2026-11-01T10:00:00Z');
    expect(subject).toBe('Не удалось продлить подписку Pro');
    expect(plaintext).toContain('«Настройки → Подписка»');
    expect(plaintext).toContain('сохранятся');
    expect(html).toContain('Настройки → Подписка');
  });
});
