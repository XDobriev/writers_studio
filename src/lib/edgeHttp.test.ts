import { describe, expect, it } from 'vitest';
import { bearer, clientIp, corsHeaders } from '../../supabase/functions/_shared/http.ts';

const req = (headers: Record<string, string>) => new Request('https://x.test/', { headers });

// CORS-белый список: '*' на платёжных функциях был бы дырой, а отказ своему origin ломает оплату.
describe('corsHeaders', () => {
  it.each([
    'https://avtorstudio.com',
    'https://www.avtorstudio.com',
    'https://avtorskaya-studiya.vercel.app',
    'http://localhost:5273',
    'http://127.0.0.1:5273',
  ])('origin из белого списка отражается: %s', (origin) => {
    expect(corsHeaders(req({ Origin: origin }))['Access-Control-Allow-Origin']).toBe(origin);
  });

  it('превью Vercel проекта разрешено', () => {
    const origin = 'https://avtorskaya-studiya-git-agent-x-khamza-s-projects.vercel.app';
    expect(corsHeaders(req({ Origin: origin }))['Access-Control-Allow-Origin']).toBe(origin);
  });

  it.each([
    'https://evil.example',
    'https://avtorstudio.com.evil.example',
    'https://other-project.vercel.app',
    'http://avtorstudio.com',
    'https://avtorskaya-studiya-x.vercel.app.evil.example',
  ])('чужой origin получает прод-origin, а не свой: %s', (origin) => {
    expect(corsHeaders(req({ Origin: origin }))['Access-Control-Allow-Origin']).toBe('https://avtorstudio.com');
  });

  it('без Origin — прод-origin; Vary: Origin всегда (кэш не смешивает ответы)', () => {
    const h = corsHeaders(req({}));
    expect(h['Access-Control-Allow-Origin']).toBe('https://avtorstudio.com');
    expect(h.Vary).toBe('Origin');
  });
});

// Токен пользователя для process-refund / cancel-subscription.
describe('bearer', () => {
  it('достаёт токен', () => {
    expect(bearer(req({ Authorization: 'Bearer abc.def' }))).toBe('abc.def');
  });

  it('нет заголовка или другая схема — null', () => {
    expect(bearer(req({}))).toBeNull();
    expect(bearer(req({ Authorization: 'Basic abc' }))).toBeNull();
    expect(bearer(req({ Authorization: 'bearer abc' }))).toBeNull();
  });
});

// IP идёт в журнал согласий/аудита: берём клиента, а не промежуточный прокси.
describe('clientIp', () => {
  it('первый IP из x-forwarded-for', () => {
    expect(clientIp(req({ 'x-forwarded-for': ' 1.1.1.1 , 2.2.2.2' }))).toBe('1.1.1.1');
  });

  it('x-forwarded-for приоритетнее x-real-ip', () => {
    expect(clientIp(req({ 'x-forwarded-for': '1.1.1.1', 'x-real-ip': '9.9.9.9' }))).toBe('1.1.1.1');
  });

  it('нет x-forwarded-for — x-real-ip; нет обоих — null', () => {
    expect(clientIp(req({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9');
    expect(clientIp(req({}))).toBeNull();
  });

  it('значение обрезается до 64 символов (поле в БД не должно переполниться)', () => {
    expect(clientIp(req({ 'x-forwarded-for': 'a'.repeat(100) }))).toHaveLength(64);
  });
});
