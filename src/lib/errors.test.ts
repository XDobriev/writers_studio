import { describe, it, expect, vi } from 'vitest';

vi.mock('@sentry/react', () => ({ captureMessage: vi.fn() }));
vi.mock('./auth', () => ({
  translateAuthError: (m: string) => (m === 'Invalid login credentials' ? 'Неверная почта или пароль.' : m),
}));

import { toUserMessage } from './errors';

describe('toUserMessage', () => {
  it('сырые ошибки Postgres/PostgREST не попадают в интерфейс', () => {
    expect(toUserMessage('[books] new row violates row-level security policy for table "books"'))
      .toMatch(/Нет доступа/);
    expect(toUserMessage({ message: 'duplicate key value', code: '23505' })).toBe('Такая запись уже существует.');
  });

  it('сеть', () => {
    expect(toUserMessage(new TypeError('Failed to fetch'))).toMatch(/Нет соединения/);
  });

  it('лимит тарифа', () => {
    expect(toUserMessage({ message: 'plan_limit', code: 'P0001' })).toMatch(/лимит бесплатного тарифа/);
  });

  it('ошибки авторизации переводятся словарём', () => {
    expect(toUserMessage('Invalid login credentials')).toBe('Неверная почта или пароль.');
  });

  it('русское сообщение без технического префикса — как есть', () => {
    expect(toUserMessage('Не удалось сохранить цель')).toBe('Не удалось сохранить цель');
  });

  it('неизвестное английское — общий текст', () => {
    expect(toUserMessage(new Error('Edge Function returned a non-2xx status code'))).toMatch(/^Не удалось/);
  });
});
