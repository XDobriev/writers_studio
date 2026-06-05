import { test as base, expect, type Page } from '@playwright/test';

// ВАЖНО: аккаунт E2E_TEST_EMAIL должен быть на плане 'pro' в таблице profiles.
// На Free-плане: DOCX заблокирован (canExportRich=false), лимит персонажей=3.
// Если тесты начнут падать — проверить план через Supabase MCP:
//   SELECT plan FROM profiles WHERE user_id = (SELECT id FROM auth.users WHERE email = '<E2E_TEST_EMAIL>');
export async function loginAndGetBookHref(page: Page): Promise<string> {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) {
    base.skip(true, 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD не заданы — пропускаем.');
    return '';
  }
  await page.goto('/login');
  await page.locator('#auth-email').fill(email);
  await page.locator('#auth-password').fill(password);
  await page.getByRole('button', { name: 'Войти в студию' }).click();
  await page.waitForURL('**/books', { timeout: 15_000 });

  const link = page.locator('a[href^="/books/"]').first();
  const hasBooks = await link.isVisible({ timeout: 25_000 }).catch(() => false);

  if (!hasBooks) {
    const createBtn = page.getByRole('button', { name: 'Создать книгу' });
    const createBtnVisible = await createBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (createBtnVisible) {
      await createBtn.click();
      await page.locator('input[name="title"]').fill('E2E Test Book');
      await page.getByRole('button', { name: 'Создать' }).click();
      await expect(link).toBeVisible({ timeout: 15_000 });
    }
  }

  return (await link.getAttribute('href')) as string;
}
