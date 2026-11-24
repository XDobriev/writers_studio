import { test as base, expect, type Page } from '@playwright/test';
import { deleteCreatedSince } from './cleanup';

let currentBookId = '';

// После каждого теста удаляем то, что он создал в книге e2e-аккаунта (см. cleanup.ts).
// Запас в минуту — на расхождение часов машины с сервером (created_at = now() в БД).
export const test = base.extend<{ cleanupCreated: void }>({
  cleanupCreated: [async ({}, use) => {
    const since = new Date(Date.now() - 60_000);
    currentBookId = '';
    await use();
    await deleteCreatedSince(currentBookId, since);
  }, { auto: true }],
});
export { expect };

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

  // Фикстура «Осколки неба» содержит персонажей и главы для тестов редактора.
  const bookId = process.env.E2E_BOOK_ID ?? 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const href = `/books/${bookId}`;
  await expect(page.locator(`a[href="${href}"]`), 'На полке должна быть подготовленная E2E-книга').toBeVisible({ timeout: 25_000 });
  currentBookId = bookId;
  return href;
}
