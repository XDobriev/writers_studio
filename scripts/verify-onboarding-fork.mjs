import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

function readEnvLocal() {
  try {
    return Object.fromEntries(
      fs.readFileSync('.env.local', 'utf8')
        .split(/\r?\n/)
        .filter((l) => /^\w+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
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

const outDir = path.resolve('.qa/visual/onboarding-fork');
fs.mkdirSync(outDir, { recursive: true });

async function run() {
  console.log('Запуск браузерной проверки OnboardingForkModal...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 1. Авторизация
  console.log('Авторизация в локальном dev-сервере...');
  await page.goto('http://127.0.0.1:5273/login');
  await page.locator('#auth-email').fill(env.E2E_TEST_EMAIL);
  await page.locator('#auth-password').fill(env.E2E_TEST_PASSWORD);
  await page.getByRole('button', { name: 'Войти в студию' }).click();
  await page.waitForURL('**/books**', { timeout: 30000 });
  console.log('Успешный вход в /books');

  // 2. Десктоп 1440x900
  console.log('Проверка десктопа 1440x900...');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:5273/books?fork=true');
  const dialog = page.locator('[role="dialog"][aria-labelledby="onboarding-fork-title"]');
  await dialog.waitFor({ state: 'visible', timeout: 10000 });

  // Скриншот шага 1 (3 карточки)
  const desktopStep1Path = path.join(outDir, 'desktop-1440-step1.png');
  await page.screenshot({ path: desktopStep1Path });
  console.log('Скриншот десктопа (шаг 1):', desktopStep1Path);

  // Клик по карточке «Начать новую книгу»
  const card2 = page.locator('.fork-card').nth(1);
  await card2.click();
  await page.locator('#fork-book-title').waitFor({ state: 'visible', timeout: 5000 });

  // Скриншот шага 2 (структура + цель)
  const desktopStep2Path = path.join(outDir, 'desktop-1440-step2.png');
  await page.screenshot({ path: desktopStep2Path });
  console.log('Скриншот десктопа (шаг 2):', desktopStep2Path);

  // 3. Мобильный 360x780
  console.log('Проверка мобильного экрана 360x780...');
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('http://127.0.0.1:5273/books?fork=true');
  await dialog.waitFor({ state: 'visible', timeout: 10000 });

  // Скриншот шага 1 (мобилка)
  const mobileStep1Path = path.join(outDir, 'mobile-360-step1.png');
  await page.screenshot({ path: mobileStep1Path });
  console.log('Скриншот мобильного экрана (шаг 1):', mobileStep1Path);

  // Клик по карточке «Начать новую книгу» на мобилке
  const mobileCard2 = page.locator('.fork-card').nth(1);
  await mobileCard2.click();
  await page.locator('#fork-book-title').waitFor({ state: 'visible', timeout: 5000 });

  // Скриншот шага 2 (мобилка)
  const mobileStep2Path = path.join(outDir, 'mobile-360-step2.png');
  await page.screenshot({ path: mobileStep2Path });
  console.log('Скриншот мобильного экрана (шаг 2):', mobileStep2Path);

  // 4. Проверка закрытия по Escape
  console.log('Проверка Escape...');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden', timeout: 5000 });
  console.log('Диалог успешно закрыт по клавише Escape!');

  await browser.close();
  console.log('Все браузерные проверки OnboardingForkModal успешно пройдены!');
}

run().catch((e) => {
  console.error('Ошибка браузерной проверки:', e);
  process.exit(1);
});
