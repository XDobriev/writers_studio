import { test, expect, type Page } from '@playwright/test';

async function loginAndGetBookHref(page: Page): Promise<string> {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) {
    test.skip(true, 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD не заданы — пропускаем.');
    return '';
  }
  await page.goto('/login');
  await page.locator('#auth-email').fill(email);
  await page.locator('#auth-password').fill(password);
  await page.getByRole('button', { name: 'Войти в студию' }).click();
  await page.waitForURL('**/books', { timeout: 15_000 });
  const link = page.locator('a[href^="/books/"]').first();
  await expect(link).toBeVisible({ timeout: 10_000 });
  return (await link.getAttribute('href')) as string;
}

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

    // Три поля Bibisco-триады должны присутствовать
    await expect(page.getByText('Внутренний мир')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Внешнее поведение')).toBeVisible();
    await expect(page.getByText('Разрыв')).toBeVisible();
  });
});
