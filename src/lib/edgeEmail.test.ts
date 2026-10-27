import { afterEach, describe, expect, it, vi } from 'vitest';
import { contactEmail, isDeliverableEmail, sendEmail } from '../../supabase/functions/_shared/email.ts';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const msg = { to: 'a@b.ru', subject: 'Тема', html: '<p>x</p>', plaintext: 'x' };

function stubEnv(env: Record<string, string>) {
  vi.stubGlobal('Deno', { env: { get: (k: string) => env[k] } });
}

describe('isDeliverableEmail', () => {
  it('отсекает пустые, кривые и синтетические *.local', () => {
    expect(isDeliverableEmail(null)).toBe(false);
    expect(isDeliverableEmail('no-at')).toBe(false);
    expect(isDeliverableEmail('tg_1@telegram.local')).toBe(false);
    expect(isDeliverableEmail('a@b.ru')).toBe(true);
  });
});

describe('contactEmail (B-1)', () => {
  it('доставляемый адрес аккаунта — в приоритете', () => {
    expect(contactEmail('a@b.ru', 'pay@c.ru')).toBe('a@b.ru');
  });

  it('Telegram/VK (*.local) — адрес, введённый при оплате', () => {
    expect(contactEmail('tg_1@telegram.local', 'pay@c.ru')).toBe('pay@c.ru');
    expect(contactEmail(null, 'pay@c.ru')).toBe('pay@c.ru');
  });

  it('оба недоставляемы — null (письма не шлём, в Receipt не передаём)', () => {
    expect(contactEmail('tg_1@telegram.local', null)).toBeNull();
    expect(contactEmail('vk_1@vk.local', 'x@y.local')).toBeNull();
    expect(contactEmail(undefined, undefined)).toBeNull();
  });
});

describe('sendEmail (Resend)', () => {
  it('без ключа не ходит в сеть', async () => {
    stubEnv({});
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await sendEmail(msg)).toEqual({ ok: false, error: 'RESEND_API_KEY is not set' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('шлёт Bearer-ключ, from по умолчанию и text/html', async () => {
    stubEnv({ RESEND_API_KEY: 're_key' });
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"id":"1"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await sendEmail(msg)).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_key');
    expect(JSON.parse(init.body)).toEqual({
      from: 'Авторская студия <studio@avtorstudio.com>',
      to: ['a@b.ru'],
      subject: 'Тема',
      html: '<p>x</p>',
      text: 'x',
    });
  });

  it('EMAIL_FROM переопределяет отправителя', async () => {
    stubEnv({ RESEND_API_KEY: 'k', EMAIL_FROM: 'Имя <me@x.ru>' });
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await sendEmail(msg);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).from).toBe('Имя <me@x.ru>');
  });

  it('ошибка Resend: в error попадают статус и текст, ключа нет', async () => {
    stubEnv({ RESEND_API_KEY: 'secret-key' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{"name":"validation_error","message":"domain is not verified"}', { status: 403 }),
      ),
    );
    const res = await sendEmail(msg);
    expect(res).toEqual({ ok: false, error: 'resend 403 validation_error domain is not verified' });
  });

  it('недоставляемый адрес не отправляется', async () => {
    stubEnv({ RESEND_API_KEY: 'k' });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await sendEmail({ ...msg, to: 'x@telegram.local' })).toEqual({ ok: false, error: 'undeliverable address' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
