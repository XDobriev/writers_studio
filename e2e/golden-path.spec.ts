import { test, expect, loginAndGetBookHref } from './fixtures';

/**
 * Golden-path: логин → редактор → автосохранение → перезагрузка → текст на месте.
 *
 * Пишет в собственную новую главу (её удаляет фикстура после теста), а не в первую главу
 * книги: раньше каждый прогон затирал «Пролог» e2e-книги строкой `e2e-<timestamp>`.
 * Учётные данные — E2E_TEST_EMAIL / E2E_TEST_PASSWORD.
 */
test('golden path: login → editor → autosave → reload', async ({ page }) => {
  const stamp = `e2e-${Date.now()}`;

  // ── 1. Логин + книга ───────────────────────────────────────────
  const bookHref = await loginAndGetBookHref(page);

  // ── 2. Новая глава → редактор ─────────────────────────────────
  await page.goto(bookHref + '/outline');
  const newChapterBtn = page.getByRole('button', { name: 'Новая глава' }).first();
  await expect(newChapterBtn).toBeVisible({ timeout: 15_000 });
  await newChapterBtn.click();
  await expect(page).toHaveURL(/\/editor\?chapter=/, { timeout: 10_000 });

  // ── 3. Отклоняем cookie banner (если показался) ────────────────
  const cookieBtn = page.getByRole('button', { name: 'Принять' });
  await cookieBtn.click({ timeout: 5_000 }).catch(() => { /* баннера нет — окей */ });

  // ── 4. Ждём редактор ───────────────────────────────────────────
  const editor = page.locator('[contenteditable="true"]').first();
  await expect(editor).toBeVisible({ timeout: 20_000 });

  // ── 5. Печатаем штамп ──────────────────────────────────────────
  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(stamp);

  // ── 6. Ждём автосохранения (дебаунс + сеть) ───────────────────
  await page.waitForTimeout(4_000);

  // ── 7. Reload и проверка ───────────────────────────────────────
  await page.reload();
  await cookieBtn.click({ timeout: 3_000 }).catch(() => {});

  const editorAfterReload = page.locator('[contenteditable="true"]').first();
  await expect(editorAfterReload).toBeVisible({ timeout: 20_000 });
  await expect(editorAfterReload).toContainText(stamp, { timeout: 10_000 });
});
