import { test, expect } from '@playwright/test';
import { loginAndGetBookHref } from './fixtures';

/**
 * Экспорт книги в DOCX.
 * Проверяем что файл начинает скачиваться — не парсим содержимое.
 */
test('export: скачать DOCX', async ({ page }) => {
  const bookHref = await loginAndGetBookHref(page);

  await page.goto(bookHref + '/export');

  // Ждём заголовок страницы экспорта
  await expect(page.getByText('Экспорт книги')).toBeVisible({ timeout: 15_000 });

  // Выбираем DOCX (по умолчанию открывается EPUB)
  await page.locator('button', { hasText: 'Word, для редактора' }).click();

  // DOCX выбран — проверяем кнопку скачивания
  const downloadBtn = page.getByRole('button', { name: /Скачать DOCX/i });
  await expect(downloadBtn).toBeVisible({ timeout: 5_000 });

  // Ловим событие download
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20_000 }),
    downloadBtn.click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/\.docx$/i);
});
