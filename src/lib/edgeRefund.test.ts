import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildRefundJwt, createRefund } from '../../supabase/functions/_shared/refund.ts';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('buildRefundJwt', () => {
  it('HS256 на Password3, payload с OpKey', async () => {
    const jwt = await buildRefundJwt({ OpKey: 'op-1' }, 'secret');
    const [h, b, sig] = jwt.split('.');
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(JSON.parse(Buffer.from(b, 'base64url').toString())).toEqual({ OpKey: 'op-1' });
    expect(sig).toBe(createHmac('sha256', 'secret').update(`${h}.${b}`).digest('base64url'));
  });
});

describe('createRefund', () => {
  it('POST Refund/Create, тело — JWT JSON-строкой; разбирает ответ', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"success":true,"requestId":"r1"}'));
    vi.stubGlobal('fetch', fetchMock);
    expect(await createRefund('op-1', 'secret')).toEqual({ kind: 'created', requestId: 'r1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://services.robokassa.ru/RefundService/Refund/Create');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toBe(await buildRefundJwt({ OpKey: 'op-1' }, 'secret'));
  });

  it('8401 в сыром не-JSON ответе — insufficient_balance', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Refund error 8401')));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await createRefund('op-1', 'secret')).toEqual({ kind: 'insufficient_balance' });
  });
});
