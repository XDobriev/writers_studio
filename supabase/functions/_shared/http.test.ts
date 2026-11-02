import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bearer,
  clientIp,
  corsHeaders,
  json,
  runInBackground,
  text,
} from './http.ts';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const req = (headers: Record<string, string>, method = 'GET') =>
  new Request('https://api.test/endpoint', { method, headers });

describe('corsHeaders', () => {
  it.each([
    'https://avtorstudio.com',
    'https://www.avtorstudio.com',
    'https://avtorskaya-studiya.vercel.app',
    'http://localhost:5273',
    'http://127.0.0.1:5273',
  ])('разрешенный origin из белого списка отражается в заголовке: %s', (origin) => {
    const headers = corsHeaders(req({ Origin: origin }));
    expect(headers['Access-Control-Allow-Origin']).toBe(origin);
  });

  it('превью-деплои Vercel проекта разрешены по регулярному выражению', () => {
    const previewOrigin = 'https://avtorskaya-studiya-git-night-tests-x.vercel.app';
    const headers = corsHeaders(req({ Origin: previewOrigin }));
    expect(headers['Access-Control-Allow-Origin']).toBe(previewOrigin);
  });

  it.each([
    'https://evil.example',
    'https://avtorstudio.com.evil.example',
    'https://other-site.vercel.app',
    'http://avtorstudio.com',
    'https://avtorskaya-studiya-x.vercel.app.evil.example',
  ])('неразрешенный чужой origin получает прод-origin вместо своего: %s', (origin) => {
    const headers = corsHeaders(req({ Origin: origin }));
    expect(headers['Access-Control-Allow-Origin']).toBe('https://avtorstudio.com');
  });

  it('запрос без заголовка Origin получает прод-origin и заголовок Vary: Origin', () => {
    const headers = corsHeaders(req({}));
    expect(headers['Access-Control-Allow-Origin']).toBe('https://avtorstudio.com');
    expect(headers['Vary']).toBe('Origin');
  });

  it('содержит корректные заголовки для preflight OPTIONS запросов', () => {
    const preflightReq = req(
      {
        Origin: 'https://avtorstudio.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, content-type',
      },
      'OPTIONS',
    );

    const headers = corsHeaders(preflightReq);
    expect(headers['Access-Control-Allow-Origin']).toBe('https://avtorstudio.com');
    expect(headers['Access-Control-Allow-Methods']).toBe('POST, OPTIONS');
    expect(headers['Access-Control-Allow-Headers']).toBe(
      'authorization, x-client-info, apikey, content-type',
    );
    expect(headers['Vary']).toBe('Origin');
  });
});

describe('json and text response helpers', () => {
  it('json() создает Response со статусом, телом и заголовками', async () => {
    const res = json(201, { success: true }, { 'X-Custom': 'val' });
    expect(res.status).toBe(201);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(res.headers.get('X-Custom')).toBe('val');
    expect(await res.json()).toEqual({ success: true });
  });

  it('text() создает текстовый Response', async () => {
    const res = text(200, 'OK123');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/plain');
    expect(await res.text()).toBe('OK123');
  });
});

describe('bearer', () => {
  it('извлекает Bearer-токен из заголовка Authorization', () => {
    expect(bearer(req({ Authorization: 'Bearer my-secret-token' }))).toBe('my-secret-token');
  });

  it('возвращает null при отсутствии или неподходящей схеме', () => {
    expect(bearer(req({}))).toBeNull();
    expect(bearer(req({ Authorization: 'Basic dXNlcjpwYXNz' }))).toBeNull();
    expect(bearer(req({ Authorization: 'bearer lowercase' }))).toBeNull();
  });
});

describe('clientIp', () => {
  it('берет первый IP из x-forwarded-for с обрезкой пробелов', () => {
    expect(clientIp(req({ 'x-forwarded-for': ' 203.0.113.195 , 70.41.3.18 ' }))).toBe('203.0.113.195');
  });

  it('x-forwarded-for имеет приоритет над x-real-ip', () => {
    expect(clientIp(req({ 'x-forwarded-for': '1.2.3.4', 'x-real-ip': '5.6.7.8' }))).toBe('1.2.3.4');
  });

  it('fallback на x-real-ip при отсутствии x-forwarded-for', () => {
    expect(clientIp(req({ 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8');
  });

  it('возвращает null при отсутствии обоих заголовков', () => {
    expect(clientIp(req({}))).toBeNull();
  });

  it('обрезает значение IP до 64 символов для безопасности схемы БД', () => {
    const longIp = 'a'.repeat(100);
    expect(clientIp(req({ 'x-forwarded-for': longIp }))).toHaveLength(64);
  });
});

describe('runInBackground', () => {
  it('передает промис в EdgeRuntime.waitUntil, если рантайм доступен', () => {
    const waitUntilMock = vi.fn();
    vi.stubGlobal('EdgeRuntime', { waitUntil: waitUntilMock });

    const p = Promise.resolve('ok');
    runInBackground(p);
    expect(waitUntilMock).toHaveBeenCalledWith(p);
  });

  it('обрабатывает промис без ошибки, если EdgeRuntime отсутствует', async () => {
    vi.stubGlobal('EdgeRuntime', undefined);

    let rejected = false;
    const failingPromise = Promise.reject(new Error('fail')).catch(() => {
      rejected = true;
    });

    runInBackground(failingPromise);
    await failingPromise;
    expect(rejected).toBe(true);
  });
});
