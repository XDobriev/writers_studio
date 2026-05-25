import { test, expect } from '@playwright/test';

/**
 * Golden-path: логин → редактор → автосохранение → перезагрузка → текст на месте.
 *
 * Требует тест-пользователя с хотя бы одной книгой и одной главой.
 * Учётные данные берутся из переменных E2E_TEST_EMAIL / E2E_TEST_PASSWORD.
 */
test('golden path: login → editor → autosave → reload', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    test.skip(true, 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD не заданы — пропускаем.');
  }

  // Уникальная метка, чтобы точно знать, что именно этот текст сохранился.
  const stamp = `e2e-${Date.now()}`;

  // ── 1. Страница логина ──────────────────────────────────────────
  await page.goto('/login');
  await page.locator('#auth-email').fill(email!);
  await page.locator('#auth-password').fill(password!);
  await page.getByRole('button', { name: 'Войти в студию' }).click();

  // Ждём редирект на /books
  await page.waitForURL('**/books', { timeout: 15_000 });

  // ── 2. Выбираем первую книгу ────────────────────────────────────
  const firstBookLink = page.locator('a[href^="/books/"]').first();
  await expect(firstBookLink).toBeVisible({ timeout: 10_000 });
  const bookHref = await firstBookLink.getAttribute('href');
  expect(bookHref).toBeTruthy();

  // Идём сразу в редактор (первая глава откроется автоматически)
  await page.goto(bookHref + '/editor');
  await page.waitForURL('**/editor', { timeout: 10_000 });

  // ── 3. Ждём загрузки TipTap ────────────────────────────────────
  const editor = page.locator('[contenteditable="true"]').first();
  await expect(editor).toBeVisible({ timeout: 15_000 });

  // ── 4. Добавляем штамп в конец текста ──────────────────────────
  await editor.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type(stamp);

  // ── 5. Ждём автосохранения (дебаунс ~700 мс + сеть) ───────────
  // Статусбар показывает «Сохранено» после успешного сохранения.
  await page.waitForTimeout(4_000);

  // ── 6. Перезагружаем страницу ──────────────────────────────────
  await page.reload();
  await page.waitForURL('**/editor', { timeout: 10_000 });
  const editorAfterReload = page.locator('[contenteditable="true"]').first();
  await expect(editorAfterReload).toBeVisible({ timeout: 15_000 });

  // ── 7. Текст должен остаться ────────────────────────────────────
  await expect(editorAfterReload).toContainText(stamp, { timeout: 10_000 });
});
