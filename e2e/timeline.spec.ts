import { test, expect } from '@playwright/test';
import { loginAndGetBookHref } from './fixtures';

test('timeline: добавить событие', async ({ page }) => {
  const bookHref = await loginAndGetBookHref(page);

  await page.goto(bookHref + '/timeline');

  // Ждём загрузки страницы
  await page.waitForLoadState('networkidle', { timeout: 15_000 });

  const isEmpty = await page.getByText('Хронология пуста').isVisible();

  if (isEmpty) {
    // Пустое состояние — кнопка в центре страницы
    await page.getByRole('button', { name: 'Создать событие' }).click();
  } else {
    // Есть события — кнопка «+» в конце ряда
    await page.locator('button[title="Добавить событие"]').first().click();
  }

  // Новое событие появляется с дефолтным заголовком «Событие»
  await expect(page.getByText('Событие').first()).toBeVisible({ timeout: 10_000 });
});
