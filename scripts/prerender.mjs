#!/usr/bin/env node
/**
 * Pre-renders public pages after `vite build` using Playwright + vite preview.
 * Saves rendered HTML to dist/ so Яндексбот and other crawlers
 * that don't execute JS still see full page content.
 *
 * Usage: node scripts/prerender.mjs
 * Requires: npx playwright install chromium (run once locally or in CI)
 *
 * Routes rendered: /, /privacy, /terms, /offer, /changelog
 *
 * Env:
 *   SKIP_PRERENDER=1   — пропустить пререндер целиком (CI-проверка сборки без Chromium).
 *   PRERENDER_STRICT=1 — любой сбой (нет Chromium, упал маршрут) → exit 1. Ставится в
 *                        деплое на VPS: без пререндера Яндексбот видит пустую страницу.
 *                        Без флага (Vercel, локально) сбой пишется в лог и сборка идёт дальше.
 *
 * Счётчик Метрики при пререндере не исполняется: src/lib/analytics.ts не стартует под
 * navigator.webdriver, а запросы к mc.yandex.ru здесь дополнительно блокируются.
 */

import { chromium } from '@playwright/test';
import { preview } from 'vite';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const STRICT = process.env.PRERENDER_STRICT === '1';

if (process.env.SKIP_PRERENDER === '1') {
  console.log('SKIP_PRERENDER=1 — пререндер пропущен.');
  process.exit(0);
}

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, 'dist');

const ROUTES = [
  { path: '/', out: 'index.html' },
  { path: '/privacy', out: 'privacy/index.html' },
  { path: '/terms', out: 'terms/index.html' },
  { path: '/offer', out: 'offer/index.html' },
  { path: '/changelog', out: 'changelog/index.html' },
];

if (!existsSync(DIST)) {
  console.error('Error: dist/ not found — run `npm run build` first');
  process.exit(1);
}

let server;
try {
  server = await preview({
    root: ROOT,
    preview: { port: 4174, strictPort: false, open: false },
  });
} catch (err) {
  console.error('Failed to start vite preview:', err.message);
  process.exit(1);
}

const urls = server.resolvedUrls;
const base = (urls?.local?.[0] ?? 'http://localhost:4174').replace(/\/$/, '');
console.log(`Preview server: ${base}`);

let browser;
try {
  browser = await chromium.launch();
} catch (err) {
  await server.close();
  if (STRICT) {
    console.error('Playwright Chromium unavailable (PRERENDER_STRICT=1):', err.message);
    process.exit(1);
  }
  console.warn('Playwright Chromium unavailable, skipping pre-render:', err.message);
  process.exit(0);
}
const context = await browser.newContext();
// Баннер куки не должен попадать в предотрисованный HTML для краулеров.
await context.addInitScript(() => {
  try { localStorage.setItem('cookie_consent_v1', 'rejected'); } catch { /* noop */ }
});
await context.route(/^https:\/\/mc\.yandex\.(ru|com)\//, (route) => route.abort());
const page = await context.newPage();
let failed = 0;

for (const { path, out } of ROUTES) {
  const url = base + path;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
    // Wait for React to mount at least one child in #root
    await page.waitForSelector('#root > *', { timeout: 10_000 });
    // Vite 8 вставляет modulepreload ленивых чанков с абсолютным href — origin этого
    // preview-сервера попал бы в прод-HTML (у посетителей — ERR_CONNECTION_REFUSED).
    const html = (await page.content()).split(base + '/').join('/');
    const outPath = join(DIST, out);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, html, 'utf8');
    console.log(`  ✓ ${path} → dist/${out}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${path}: ${err.message}`);
  }
}

await browser.close();
await server.close();
if (failed > 0 && STRICT) {
  console.error(`Pre-render failed for ${failed} route(s) (PRERENDER_STRICT=1).`);
  process.exit(1);
}
console.log('Pre-render complete.');
