import fs from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Локально переменные лежат в .env / .env.local — подхватываем их сами (окружение важнее).
// Без этого `npx playwright test` молча давал «7 skipped», что легко принять за зелёный прогон.
for (const file of ['.env', '.env.local']) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^(\w+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
}
if (process.env.CI && (!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD)) {
  throw new Error('E2E_TEST_EMAIL / E2E_TEST_PASSWORD не заданы — в CI тесты не должны пропускаться молча.');
}

/**
 * Playwright config — golden-path E2E тесты против dev-сервера.
 *
 * Переменные окружения (локально — .env / .env.local, в CI — GitHub Secrets):
 *   VITE_SUPABASE_URL      — URL проекта Supabase
 *   VITE_SUPABASE_ANON_KEY — anon-ключ
 *   E2E_TEST_EMAIL         — почта тест-пользователя
 *   E2E_TEST_PASSWORD      — пароль тест-пользователя
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,        // холодный старт + 2 навигации + 4s autosave + reload
  fullyParallel: false,   // тесты серийно — один браузер, без гонок
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: 'http://127.0.0.1:5273',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5273',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
