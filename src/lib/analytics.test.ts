// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://avtorstudio.com/"}
import { describe, it, expect, vi, beforeAll } from 'vitest';

type Call = unknown[];
const calls: Call[] = [];

beforeAll(() => {
  vi.stubEnv('PROD', true);
  window.ym = (...args: unknown[]) => { calls.push(args); };
});

describe('Метрика: просмотры страниц в SPA', async () => {
  const { setConsent, trackPageView } = await import('./analytics');

  it('до согласия ничего не шлёт', () => {
    trackPageView();
    expect(calls).toEqual([]);
  });

  it('после согласия: init с текущим URL, переход → hit с referer, повтор того же URL не дублируется', () => {
    setConsent('accepted');
    expect(calls[0][1]).toBe('init');

    history.pushState({}, '', '/books');
    trackPageView();
    trackPageView();
    const hits = calls.filter((c) => c[1] === 'hit');
    expect(hits).toEqual([[109723861, 'hit', 'https://avtorstudio.com/books', { referer: 'https://avtorstudio.com/' }]]);
  });

  it('токен публичной ссылки маскируется', () => {
    history.pushState({}, '', '/share/abc123secret');
    trackPageView();
    const last = calls[calls.length - 1];
    expect(last[2]).toBe('https://avtorstudio.com/share/[token]');
    expect(JSON.stringify(calls)).not.toContain('abc123secret');
  });
});
