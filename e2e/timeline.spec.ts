import { test, expect } from '@playwright/test';
import { loginAndGetBookHref } from './fixtures';

test('timeline: добавить событие', async ({ page }) => {
  const bookHref = await loginAndGetBookHref(page);

  await page.goto(bookHref + '/timeline');

  // Кнопка в тулбаре видна всегда — не зависит от ResizeObserver / containerWidth
  const addBtn = page.getByRole('button', { name: 'Событие' });
  await expect(addBtn).toBeVisible({ timeout: 15_000 });

  const countBefore = await page.getByText('Событие').count();
  await addBtn.click();

  // Новое событие с дефолтным заголовком «Событие» увеличивает счётчик
  await expect(page.getByText('Событие')).toHaveCount(countBefore + 1, { timeout: 10_000 });
});
