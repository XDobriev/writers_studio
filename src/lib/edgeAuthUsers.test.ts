import { describe, expect, it, vi } from 'vitest';
import { isEmailSquatter, releaseSquattedEmail } from '../../supabase/functions/_shared/authUsers';

describe('isEmailSquatter', () => {
  it('аккаунт без telegram_id/vk_id — захватчик служебного адреса', () => {
    expect(isEmailSquatter({ provider: 'email', providers: ['email'] })).toBe(true);
    expect(isEmailSquatter({})).toBe(true);
  });

  it('аккаунт Telegram или VK захватчиком не считается', () => {
    expect(isEmailSquatter({ telegram_id: 123 })).toBe(false);
    expect(isEmailSquatter({ vk_id: 456 })).toBe(false);
  });
});

describe('releaseSquattedEmail', () => {
  const adminWith = (error: { message: string } | null) => {
    const updateUserById = vi.fn().mockResolvedValue({ error });
    return { admin: { auth: { admin: { updateUserById } } }, updateUserById };
  };

  it('переименовывает аккаунт, а не удаляет', async () => {
    const { admin, updateUserById } = adminWith(null);
    expect(await releaseSquattedEmail(admin, 'u1')).toEqual({ ok: true });
    expect(updateUserById).toHaveBeenCalledWith('u1', { email: 'released-u1@invalid.local', email_confirm: true });
  });

  it('возвращает ошибку Supabase', async () => {
    const { admin } = adminWith({ message: 'boom' });
    expect(await releaseSquattedEmail(admin, 'u1')).toEqual({ ok: false, error: 'boom' });
  });
});
