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
import { writeFileSync, mkdirSync, existsSync, readdirSync, lstatSync, unlinkSync, rmdirSync } from 'fs';
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
  { path: '/privacy', out: 'privacy.html' },
  { path: '/terms', out: 'terms.html' },
  { path: '/offer', out: 'offer.html' },
  { path: '/changelog', out: 'changelog.html' },
];

if (!existsSync(DIST)) {
  console.error('Error: dist/ not found — run `npm run build` first');
  process.exit(1);
}

function removePath(target) {
  if (!existsSync(target)) return;
  if (lstatSync(target).isDirectory()) {
    for (const entry of readdirSync(target)) {
      removePath(join(target, entry));
    }
    rmdirSync(target);
  } else {
    unlinkSync(target);
  }
}

// Удаляем старые папки (/offer/index.html) и прежние .html до запуска vite preview,
// чтобы preview-сервер гарантированно отдавал свежий dist/index.html от vite build.
for (const { path, out } of ROUTES) {
  if (path !== '/') {
    removePath(join(DIST, path.slice(1)));
    removePath(join(DIST, out));
  }
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
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
});
// Баннер куки не должен попадать в предотрисованный HTML для краулеров.
await context.addInitScript(() => {
  try { localStorage.setItem('cookie_consent_v1', 'rejected'); } catch { /* noop */ }
});
await context.route(/^https:\/\/mc\.yandex\.(ru|com)\//, (route) => route.abort());
const page = await context.newPage();
let failed = 0;

async function revealAllScrollSections(p) {
  await p.evaluate(async () => {
    const step = Math.max(300, Math.floor(window.innerHeight * 0.45));
    const maxScroll = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    for (let y = 0; y <= maxScroll; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    const stillZero = Array.from(document.querySelectorAll('#root [style*="opacity"]')).filter(
      (el) => parseFloat(getComputedStyle(el).opacity) === 0,
    );
    for (const el of stillZero) {
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 80));
    }
    window.scrollTo(0, 0);
  });
  const hasAnimated = await p.evaluate(() => document.querySelectorAll('#root [style*="opacity"]').length > 0);
  if (!hasAnimated) return;
  await p
    .waitForFunction(
      () =>
        Array.from(document.querySelectorAll('#root [style*="opacity"]')).every(
          (el) => parseFloat(getComputedStyle(el).opacity) > 0.05,
        ),
      null,
      { timeout: 4000 },
    )
    .catch(() => {});
  // Даём пружинным анимациям последнего видимого блока дойти до opacity: 1
  await p.waitForTimeout(700);
}

for (const { path, out } of ROUTES) {
  const url = base + path;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
    // Ждём рендера самой страницы (h1), а не промежуточного Suspense-спиннера
    await page.waitForSelector('#root h1', { timeout: 10_000 });
    // Активируем whileInView-секции, чтобы в статическом HTML не оставались блоки с opacity: 0
    await revealAllScrollSections(page);
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
