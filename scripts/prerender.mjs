#!/usr/bin/env node
/**
 * Pre-renders public pages after `vite build` using Playwright + vite preview.
 * Saves rendered HTML to dist/ so Яндексбот and other crawlers
 * that don't execute JS still see full page content.
 *
 * Usage: node scripts/prerender.mjs
 * Requires: npx playwright install chromium (run once locally or in CI)
 *
 * Routes rendered: /, /privacy, /terms
 */

import { chromium } from '@playwright/test';
import { preview } from 'vite';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, 'dist');

const ROUTES = [
  { path: '/', out: 'index.html' },
  { path: '/privacy', out: 'privacy/index.html' },
  { path: '/terms', out: 'terms/index.html' },
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

const browser = await chromium.launch();
const page = await browser.newPage();

for (const { path, out } of ROUTES) {
  const url = base + path;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
    // Wait for React to mount at least one child in #root
    await page.waitForSelector('#root > *', { timeout: 10_000 });
    const html = await page.content();
    const outPath = join(DIST, out);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, html, 'utf8');
    console.log(`  ✓ ${path} → dist/${out}`);
  } catch (err) {
    console.error(`  ✗ ${path}: ${err.message}`);
    // Non-fatal: build proceeds even if one route fails
  }
}

await browser.close();
await server.close();
console.log('Pre-render complete.');
