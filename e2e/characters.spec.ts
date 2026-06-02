import { test, expect } from '@playwright/test';
import { loginAndGetBookHref } from './fixtures';

test.describe('Картотека персонажей', () => {
  test('detail → клик по «Персонажи» в сайдбаре не показывает пустое состояние', async ({ page }) => {
    const bookHref = await loginAndGetBookHref(page);

    await page.goto(bookHref + '/characters');

    // Ждём карточки персонажей
    const card = page.locator('[data-testid="character-card"]').first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    // Входим в detail mode
    await card.click();
    await expect(page).toHaveURL(/character=/, { timeout: 5_000 });

    // Кликаем по «Персонажи» в сайдбаре — URL теряет ?character=
    await page.getByRole('link', { name: 'Персонажи', exact: true }).click();

    // «Картотека пуста» не должна появиться
    await expect(page.getByText('Картотека пуста')).not.toBeVisible();

    // Карточки должны быть видны (grid mode восстановился)
    await expect(card).toBeVisible({ timeout: 5_000 });
  });

  test('вкладка «Сведения» содержит все поля психологии', async ({ page }) => {
    const bookHref = await loginAndGetBookHref(page);

    await page.goto(bookHref + '/characters');

    const card = page.locator('[data-testid="character-card"]').first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();
    await expect(page).toHaveURL(/character=/, { timeout: 5_000 });

    // Ждём рендера детальной панели (таб появляется одновременно с полями)
    await expect(page.getByRole('button', { name: 'Сведения' })).toBeVisible({ timeout: 8_000 });

    // Три поля Bibisco-триады должны присутствовать
    await expect(page.getByText('Внутренний мир')).toBeVisible();
    await expect(page.getByText('Внешнее поведение')).toBeVisible();
    await expect(page.getByText('Разрыв')).toBeVisible();
  });
});
