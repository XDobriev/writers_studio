import { test, expect } from '@playwright/test';
import { loginAndGetBookHref } from './fixtures';

/**
 * Создание новой главы в существующей книге.
 * Тест-аккаунт на free-плане — создание самой книги пропускаем.
 */
test('books: создать главу в существующей книге', async ({ page }) => {
  const bookHref = await loginAndGetBookHref(page);

  await page.goto(bookHref + '/outline');

  // Ждём загрузки страницы Структура
  await expect(page.getByText('Структура')).toBeVisible({ timeout: 15_000 });

  // Считаем ссылки на главы до создания
  const chapterLinks = page.locator('a[href*="/editor?chapter="]');
  const countBefore = await chapterLinks.count();

  // Кнопка в тулбаре страницы Outline
  const newChapterBtn = page.getByRole('button', { name: 'Новая глава' }).first();
  await expect(newChapterBtn).toBeVisible({ timeout: 5_000 });
  await newChapterBtn.click();

  // Ждём появления новой главы
  await expect(chapterLinks).toHaveCount(countBefore + 1, { timeout: 10_000 });
});
