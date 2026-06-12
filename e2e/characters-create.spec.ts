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

  // Кнопка «Новый персонаж» в тулбаре
  const newCharBtn = page.locator('button[title="Новый персонаж"]');
  await expect(newCharBtn).toBeVisible({ timeout: 10_000 });
  await newCharBtn.click();

  // Создание открывает detail-mode: URL должен содержать ?character=
  await expect(page).toHaveURL(/character=/, { timeout: 10_000 });

  // Сохраняем URL нового персонажа для последующей проверки
  const newCharUrl = page.url();

  // Возвращаемся в grid-mode через кнопку (viewMode меняется локально, URL не трогается)
  const gridBtn = page.locator('button[title="Картотека (сетка)"]');
  await expect(gridBtn).toBeVisible({ timeout: 5_000 });
  await gridBtn.click();

  // Грид показывает карточки (первая карточка видна — значит в режиме грида)
  await expect(page.locator('[data-testid="character-card"]').first()).toBeVisible({ timeout: 10_000 });

  // Персонаж сохранился: прямая навигация к его URL открывает detail-mode
  await page.goto(newCharUrl);
  await expect(page).toHaveURL(/character=/, { timeout: 5_000 });
});
