import { test, expect } from '@playwright/test';
import { loginAndGetBookHref } from './fixtures';

test('characters: создать нового персонажа', async ({ page }) => {
  const bookHref = await loginAndGetBookHref(page);

  await page.goto(bookHref + '/characters');

  // Ждём загрузки картотеки (карточки или пустое состояние)
  await page.waitForSelector('[data-testid="character-card"], [data-testid="characters-empty"]', {
    timeout: 15_000,
    state: 'attached',
  }).catch(() => {
    // Если ни того, ни другого — просто ждём тулбар
  });

  const cardsBefore = await page.locator('[data-testid="character-card"]').count();

  // Кнопка «Новый персонаж» в тулбаре
  const newCharBtn = page.locator('button[title="Новый персонаж"]');
  await expect(newCharBtn).toBeVisible({ timeout: 10_000 });
  await newCharBtn.click();

  // Создание открывает detail-mode: URL должен содержать ?character=
  await expect(page).toHaveURL(/character=/, { timeout: 10_000 });

  // Возвращаемся в grid-mode убирая query-параметр
  const gridUrl = bookHref + '/characters';
  await page.goto(gridUrl);

  // Карточек стало больше
  await expect(page.locator('[data-testid="character-card"]')).toHaveCount(
    cardsBefore + 1,
    { timeout: 10_000 },
  );
});
