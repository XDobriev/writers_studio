import { test, expect } from '@playwright/test';
import { loginAndGetBookHref } from './fixtures';

/**
 * Создание новой главы в существующей книге.
 * Тест-аккаунт на free-плане — создание самой книги пропускаем.
 */
test('books: создать главу в существующей книге', async ({ page }) => {
  const bookHref = await loginAndGetBookHref(page);

  await page.goto(bookHref + '/outline');

  // Кнопка в тулбаре — ждём загрузки страницы
  const newChapterBtn = page.getByRole('button', { name: 'Новая глава' }).first();
  await expect(newChapterBtn).toBeVisible({ timeout: 15_000 });
  await newChapterBtn.click();

  // После создания главы приложение открывает редактор для неё
  await expect(page).toHaveURL(/\/editor\?chapter=/, { timeout: 10_000 });
});
