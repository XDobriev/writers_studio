import fs from 'node:fs';
import { test, expect } from '@playwright/test';

const vercelCsp = JSON.parse(fs.readFileSync('vercel.json', 'utf8')).headers[0].headers
  .find((header: { key: string }) => header.key === 'Content-Security-Policy').value;
const nginxCsp = fs.readFileSync('deploy/nginx.conf', 'utf8').match(/default "(default-src[^"\n]+)";/)?.[1];

for (const [host, csp] of [['nginx', nginxCsp], ['vercel', vercelCsp]]) {
  test(`Telegram official redirect widget creates iframe with ${host} CSP`, async ({ page }) => {
    expect(csp).toBeTruthy();
    expect(csp).not.toContain('unsafe-eval');
    await page.route('**/login', async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
    });
    // The iframe's content belongs to Telegram; creation by the real official JS is the regression.
    await page.route('https://oauth.telegram.org/**', (route) => route.fulfill({ contentType: 'text/html', body: '<button>Telegram</button>' }));
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/login');
    const script = page.locator('script[data-telegram-login]');
    await expect(script).toHaveCount(1);
    await expect(script).not.toHaveAttribute('data-onauth');
    await expect(script).toHaveAttribute('data-auth-url', /\/login\?tg_state=/);
    await expect(page.locator('iframe[id^="telegram-login-"]')).toBeAttached({ timeout: 30_000 });
    const iframeSrc = await page.locator('iframe[id^="telegram-login-"]').getAttribute('src');
    const authUrl = await script.getAttribute('data-auth-url');
    expect(new URL(iframeSrc!).searchParams.get('return_to')).toBe(authUrl);
    expect(errors.filter((message) => /eval|content security policy/i.test(message))).toEqual([]);
  });
}
