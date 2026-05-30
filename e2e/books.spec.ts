import { test, expect } from '@playwright/test';
import { loginAndGetBookHref } from './fixtures';

/**
 * Создание новой главы в существующей книге.
 * Тест-аккаунт на free-плане — создание самой книги пропускаем.
 */
test('books: создать главу в существующей книге', async ({ page }) => {
  const bookHref = await loginAndGetBookHref(page);

  await page.goto(bookHref + '/outline');

  // Считаем ссылки на главы до создания
  const chapterLinks = page.locator('a[href*="/editor?chapter="]');
  const countBefore = await chapterLinks.count();

  // Кнопка в тулбаре страницы Outline — ждём загрузки (15 сек на первый рендер)
  const newChapterBtn = page.getByRole('button', { name: 'Новая глава' }).first();
  await expect(newChapterBtn).toBeVisible({ timeout: 15_000 });
  await newChapterBtn.click();

  // Ждём появления новой главы
  await expect(chapterLinks).toHaveCount(countBefore + 1, { timeout: 10_000 });
});
