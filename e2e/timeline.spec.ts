import { test, expect } from '@playwright/test';
import { loginAndGetBookHref } from './fixtures';

test('timeline: добавить событие', async ({ page }) => {
  const bookHref = await loginAndGetBookHref(page);

  await page.goto(bookHref + '/timeline');

  // Кнопка в тулбаре видна всегда — не зависит от ResizeObserver / containerWidth
  const addBtn = page.getByRole('button', { name: 'Событие', exact: true });
  await expect(addBtn).toBeVisible({ timeout: 15_000 });

  // EventCard рендерит название как <input>, не как текст — считаем по placeholder
  const inputsBefore = await page.getByPlaceholder('Название события').count();
  await addBtn.click();

  // Новая карточка события появляется в списке
  await expect(page.getByPlaceholder('Название события')).toHaveCount(inputsBefore + 1, { timeout: 10_000 });
});
