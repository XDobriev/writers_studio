import fs from 'node:fs';
import { test, expect } from '@playwright/test';

const vercelCsp = JSON.parse(fs.readFileSync('vercel.json', 'utf8')).headers[0].headers
  .find((header: { key: string }) => header.key === 'Content-Security-Policy').value;
const nginxCsp = fs.readFileSync('deploy/nginx.conf', 'utf8').match(/default "(default-src[^"\n]+)";/)?.[1];

for (const [host, csp] of [['nginx', nginxCsp], ['vercel', vercelCsp]]) {
  test(`VK ID button is always visible and accessible with ${host} CSP even with adblocker`, async ({ page }) => {
    expect(csp).toBeTruthy();

    // Симулируем жесткий блокировщик рекламы/трекеров (блокировка unpkg и трекеров VK)
    await page.route('**/*unpkg.com/**', (route) => route.abort());
    await page.route('**/*stat_events_vkid_sdk/**', (route) => route.abort());

    await page.route('**/login', async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
    });

    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/login');

    // Кнопка входа через VK ID должна быть видна
    const vkButton = page.locator('button:has-text("Войти через VK ID")');
    await expect(vkButton).toBeVisible({ timeout: 15_000 });
    await expect(vkButton).toBeEnabled();

    // Не должно быть ошибок CSP
    expect(errors.filter((message) => /eval|content security policy/i.test(message))).toEqual([]);
  });
}
