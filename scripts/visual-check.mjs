// Визуальная регрессия: снимает страницы «до» (прод = main) и «после» (локальный dev-сервер ветки),
// сравнивает попиксельно и показывает, где правка задела то, что не должна была.
//
//   node scripts/visual-check.mjs                       # все страницы, desktop + mobile
//   node scripts/visual-check.mjs --only notes,editor   # подмножество (по имени страницы/сценария)
//   node scripts/visual-check.mjs --scenario .qa/notes.mjs   # + сценарии фичи (до/после в PR)
//   --before <url> (по умолчанию https://avtorstudio.com)  --after <url> (http://127.0.0.1:5273)
//
// Нужен запущенный `npm run dev`. Логин — e2e-аккаунт из .env.local (E2E_TEST_EMAIL/PASSWORD).
// Результат: .qa/visual/<время>/{before,after,diff}/*.png + report.md.
//
// Сценарий — модуль с `export default [{ name, path, viewports?, run: async (page) => {} }]`;
// `path` может содержать :id (первая книга аккаунта). `run` приводит страницу в нужное состояние.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const BEFORE = args.before ?? 'https://avtorstudio.com';
const AFTER = args.after ?? 'http://127.0.0.1:5273';
const ONLY = args.only?.split(',');
// Доля отличающихся пикселей, выше которой страница считается изменённой.
const THRESHOLD = Number(args.threshold ?? 0.003);

const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };

const PAGES = [
  { name: 'landing', path: '/', auth: false },
  { name: 'offer', path: '/offer', auth: false },
  { name: 'login', path: '/login', auth: false },
  { name: 'demo', path: '/demo', auth: false },
  { name: 'books', path: '/books' },
  { name: 'dashboard', path: '/books/:id' },
  { name: 'editor', path: '/books/:id/editor' },
  { name: 'focus', path: '/books/:id/focus' },
  { name: 'split', path: '/books/:id/split' },
  { name: 'outline', path: '/books/:id/outline' },
  { name: 'corkboard', path: '/books/:id/corkboard' },
  { name: 'characters', path: '/books/:id/characters' },
  { name: 'timeline', path: '/books/:id/timeline' },
  { name: 'notes', path: '/books/:id/notes' },
  { name: 'map', path: '/books/:id/map' },
  { name: 'export', path: '/books/:id/export' },
  { name: 'dictionary', path: '/dictionary' },
];

const FREEZE_CSS = `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}`;

function readEnvLocal() {
  try {
    return Object.fromEntries(
      fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
    );
  } catch {
    return {};
  }
}

const env = { ...readEnvLocal(), ...process.env };
if (!env.E2E_TEST_EMAIL || !env.E2E_TEST_PASSWORD) {
  console.error('Нет E2E_TEST_EMAIL / E2E_TEST_PASSWORD (.env.local или окружение).');
  process.exit(1);
}

async function login(context, base) {
  const page = await context.newPage();
  await page.goto(base + '/login');
  await page.locator('#auth-email').fill(env.E2E_TEST_EMAIL);
  await page.locator('#auth-password').fill(env.E2E_TEST_PASSWORD);
  await page.getByRole('button', { name: 'Войти в студию' }).click();
  await page.waitForURL('**/books', { timeout: 30_000 });
  const href = await page.locator('a[href^="/books/"]').first().getAttribute('href', { timeout: 30_000 });
  await page.close();
  return href.split('/')[2];
}

// Шум в консоли, который не зависит от кода ветки: VK ID и сертификаты на localhost;
// `promise.then is not a function` при восстановлении кэша React Query — только в dev (см. roadmap).
const NOISE = /vk\.ru|vkid|ERR_CERT|ERR_FAILED|Failed to load resource|promise\.then is not a function/;
const normalizeError = (t) => t.replace(/https?:\/\/[^\s)]+/g, '<url>').replace(/\?v=\w+/g, '').slice(0, 200);

// Страница готова, когда сеть утихла и пропали индикаторы загрузки — иначе снимок ловит «Загрузка…».
async function waitReady(page) {
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForFunction(
    () => !document.body.innerText.includes('Загрузка…') && !document.querySelector('.skeleton'),
    null,
    { timeout: 20_000 },
  ).catch(() => {});
}

async function shoot(context, base, bookId, target, viewport, file) {
  const page = await context.newPage();
  await page.setViewportSize(VIEWPORTS[viewport]);
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && !NOISE.test(m.text()) && errors.push(normalizeError(m.text())));
  page.on('pageerror', (e) => !NOISE.test(String(e)) && errors.push(normalizeError(String(e))));
  await page.goto(base + target.path.replace(':id', bookId), { waitUntil: 'load' });
  await page.addStyleTag({ content: FREEZE_CSS });
  await waitReady(page);
  await page.waitForTimeout(1000);
  if (target.run) await target.run(page);
  await page.waitForTimeout(500);
  await page.screenshot({ path: file, fullPage: !target.run });
  await page.close();
  return errors;
}

// Сравнение в браузере через canvas — без зависимостей вроде pixelmatch.
async function compare(page, fileA, fileB, fileDiff) {
  const toUrl = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  const res = await page.evaluate(async ({ a, b }) => {
    const load = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const w = Math.max(ia.width, ib.width), h = Math.max(ia.height, ib.height);
    const data = (img) => { const c = new OffscreenCanvas(w, h); const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data; };
    const da = data(ia), db = data(ib);
    const out = new OffscreenCanvas(w, h), ox = out.getContext('2d'), od = ox.createImageData(w, h);
    let diff = 0;
    for (let p = 0; p < da.length; p += 4) {
      const d = Math.abs(da[p] - db[p]) + Math.abs(da[p + 1] - db[p + 1]) + Math.abs(da[p + 2] - db[p + 2]) + Math.abs(da[p + 3] - db[p + 3]);
      if (d > 60) { diff++; od.data.set([255, 0, 60, 255], p); }
      else { const g = (db[p] + db[p + 1] + db[p + 2]) / 3; od.data.set([g, g, g, 70], p); }
    }
    ox.putImageData(od, 0, 0);
    const blob = await out.convertToBlob();
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = ''; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return { ratio: diff / (w * h), sizeA: [ia.width, ia.height], sizeB: [ib.width, ib.height], png: btoa(bin) };
  }, { a: toUrl(fileA), b: toUrl(fileB) });
  fs.writeFileSync(fileDiff, Buffer.from(res.png, 'base64'));
  return res;
}

const scenarios = args.scenario ? (await import(pathToFileURL(path.resolve(args.scenario)).href)).default : [];
const targets = [
  ...PAGES.map((p) => ({ ...p, kind: 'page' })),
  ...scenarios.map((s) => ({ auth: true, ...s, kind: 'scenario' })),
].filter((t) => !ONLY || ONLY.includes(t.name));

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUT = path.join('.qa', 'visual', stamp);
for (const d of ['before', 'after', 'diff']) fs.mkdirSync(path.join(OUT, d), { recursive: true });

const browser = await chromium.launch();
const mkContext = async () => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { try { localStorage.setItem('cookie_consent_v1', 'accepted'); } catch { /* приватный режим */ } });
  return ctx;
};
const ctxBefore = await mkContext(), ctxAfter = await mkContext();
const ctxAnon = await mkContext();

const [bookBefore, bookAfter] = await Promise.all([login(ctxBefore, BEFORE), login(ctxAfter, AFTER)]);
const cmp = await browser.newPage();
const rows = [];

for (const t of targets) {
  for (const vp of t.viewports ?? Object.keys(VIEWPORTS)) {
    const name = `${t.name}-${vp}`;
    const f = (d) => path.join(OUT, d, name + '.png');
    try {
      const [errBefore, errAfter] = await Promise.all([
        shoot(t.auth === false ? ctxAnon : ctxBefore, BEFORE, bookBefore, t, vp, f('before')),
        shoot(t.auth === false ? ctxAnon : ctxAfter, AFTER, bookAfter, t, vp, f('after')),
      ]);
      const r = await compare(cmp, f('before'), f('after'), f('diff'));
      const newErrors = [...new Set(errAfter.filter((e) => !errBefore.includes(e)))];
      const changed = r.ratio > THRESHOLD || r.sizeA.join() !== r.sizeB.join();
      rows.push({ name, kind: t.kind, ratio: r.ratio, sizeA: r.sizeA, sizeB: r.sizeB, changed, newErrors });
      console.log(`${changed ? '≠' : '='} ${name.padEnd(24)} ${(r.ratio * 100).toFixed(2).padStart(6)}%${r.sizeA.join() !== r.sizeB.join() ? `  размер ${r.sizeA.join('×')} → ${r.sizeB.join('×')}` : ''}${newErrors.length ? `  новых ошибок: ${newErrors.length}` : ''}`);
    } catch (e) {
      rows.push({ name, kind: t.kind, failed: String(e.message).split('\n')[0] });
      console.log(`! ${name.padEnd(24)} не снялось: ${String(e.message).split('\n')[0]}`);
    }
  }
}
await browser.close();

const md = [
  `# Визуальная регрессия — ${stamp}`,
  ``,
  `До: ${BEFORE} · После: ${AFTER} · Порог: ${(THRESHOLD * 100).toFixed(1)}%`,
  ``,
  `| | Экран | Отличие | Размер до → после | Новые ошибки консоли |`,
  `|---|---|---|---|---|`,
  ...rows.map((r) => r.failed
    ? `| ! | ${r.name} | не снялось: ${r.failed} | | |`
    : `| ${r.changed ? '≠' : '='} | ${r.name} | ${(r.ratio * 100).toFixed(2)}% | ${r.sizeA.join('×')} → ${r.sizeB.join('×')} | ${r.newErrors.join('<br>') || '—'} |`),
].join('\n');
fs.writeFileSync(path.join(OUT, 'report.md'), md + '\n');
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(rows, null, 2));
console.log(`\nОтчёт: ${path.join(OUT, 'report.md')}`);
