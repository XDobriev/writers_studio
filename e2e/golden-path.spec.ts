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

  const stamp = `e2e-${Date.now()}`;

  // ── 1. Логин ───────────────────────────────────────────────────
  await page.goto('/login');
  await page.locator('#auth-email').fill(email!);
  await page.locator('#auth-password').fill(password!);
  await page.getByRole('button', { name: 'Войти в студию' }).click();
  await page.waitForURL('**/books', { timeout: 15_000 });

  // ── 2. Первая книга → редактор ─────────────────────────────────
  const firstBookLink = page.locator('a[href^="/books/"]').first();
  await expect(firstBookLink).toBeVisible({ timeout: 10_000 });
  const bookHref = await firstBookLink.getAttribute('href');
  expect(bookHref).toBeTruthy();

  await page.goto(bookHref + '/editor');
  // Не вызываем waitForURL повторно — goto уже завершил навигацию.
  // Ждём TipTap напрямую.

  // ── 3. Отклоняем cookie banner (если показался) ────────────────
  const cookieBtn = page.getByRole('button', { name: 'Принять' });
  await cookieBtn.click({ timeout: 5_000 }).catch(() => { /* баннера нет — окей */ });

  // ── 4. Ждём редактор ───────────────────────────────────────────
  const editor = page.locator('[contenteditable="true"]').first();
  await expect(editor).toBeVisible({ timeout: 20_000 });

  // ── 5. Выделяем всё, печатаем штамп ───────────────────────────
  // Ctrl+A чистит старый контент (в т.ч. мусор от предыдущих запусков)
  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(stamp);

  // ── 6. Ждём автосохранения (дебаунс + сеть) ───────────────────
  await page.waitForTimeout(4_000);

  // ── 7. Reload и проверка ───────────────────────────────────────
  await page.reload();

  // Снова отклоняем баннер если появился после reload
  await cookieBtn.click({ timeout: 3_000 }).catch(() => {});

  const editorAfterReload = page.locator('[contenteditable="true"]').first();
  await expect(editorAfterReload).toBeVisible({ timeout: 20_000 });
  await expect(editorAfterReload).toContainText(stamp, { timeout: 10_000 });
});
