import { test, expect, loginAndGetBookHref } from './fixtures';

// B-4: быстрое создание не оставляет пустых записей-«призраков», а тронутые записи остаются.

test.describe('Пустые черновики', () => {
  test('персонаж: создан и закрыт без ввода — запись удалена', async ({ page }) => {
    const bookHref = await loginAndGetBookHref(page);
    await page.goto(bookHref + '/characters');
    const cards = page.locator('[data-testid="character-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
    const before = await cards.count();

    await page.locator('button[title="Новый персонаж"]').click();
    await expect(page).toHaveURL(/character=/, { timeout: 10_000 });
    await expect(page.getByPlaceholder('Имя персонажа')).toBeVisible();

    await page.locator('button[title="Картотека (сетка)"]').click();
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });

    // Серверная правда, а не кэш: перезагрузка
    await page.goto(bookHref + '/characters');
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
    await expect(cards).toHaveCount(before);
  });

  test('персонаж: быстрое действие дэшборда (?create=true) и уход со страницы — запись удалена', async ({ page }) => {
    const bookHref = await loginAndGetBookHref(page);
    await page.goto(bookHref + '/characters');
    const cards = page.locator('[data-testid="character-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
    const before = await cards.count();

    await page.goto(bookHref + '/characters?create=true');
    await expect(page).toHaveURL(/character=/, { timeout: 10_000 });
    await expect(page.getByPlaceholder('Имя персонажа')).toBeVisible();

    await page.getByRole('link', { name: 'Заметки', exact: true }).click();
    await expect(page).toHaveURL(/\/notes/, { timeout: 10_000 });
    await page.waitForTimeout(3500) // дать удалению дойти до сервера и сброситься в сохранённый кэш;

    await page.goto(bookHref + '/characters');
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
    await expect(cards).toHaveCount(before);
  });

  test('персонаж: введено имя — запись остаётся', async ({ page }) => {
    const bookHref = await loginAndGetBookHref(page);
    await page.goto(bookHref + '/characters');
    await expect(page.locator('[data-testid="character-card"]').first()).toBeVisible({ timeout: 15_000 });

    await page.locator('button[title="Новый персонаж"]').click();
    const name = page.getByPlaceholder('Имя персонажа');
    await expect(name).toBeVisible({ timeout: 10_000 });
    await name.fill('Тестовый Призрак');
    await page.locator('button[title="Картотека (сетка)"]').click();
    await page.waitForTimeout(3500) // дать удалению дойти до сервера и сброситься в сохранённый кэш;

    await page.goto(bookHref + '/characters');
    await expect(page.getByText('Тестовый Призрак').first()).toBeVisible({ timeout: 15_000 });
  });

  test('хронология: создано и оставлено без ввода — событие удалено при уходе со страницы', async ({ page }) => {
    const bookHref = await loginAndGetBookHref(page);
    await page.goto(bookHref + '/timeline');
    const titles = page.getByPlaceholder('Название события');
    const addBtn = page.getByRole('button', { name: 'Событие', exact: true });
    await expect(addBtn).toBeVisible({ timeout: 15_000 });
    const before = await titles.count();

    await addBtn.click();
    await expect(titles).toHaveCount(before + 1, { timeout: 10_000 });

    await page.getByRole('link', { name: 'Заметки', exact: true }).click();
    await expect(page).toHaveURL(/\/notes/, { timeout: 10_000 });
    await page.waitForTimeout(3500) // дать удалению дойти до сервера и сброситься в сохранённый кэш;

    await page.goto(bookHref + '/timeline');
    await expect(addBtn).toBeVisible({ timeout: 15_000 });
    await expect(titles).toHaveCount(before);
  });

  test('хронология: введён заголовок — событие остаётся', async ({ page }) => {
    const bookHref = await loginAndGetBookHref(page);
    await page.goto(bookHref + '/timeline');
    const titles = page.getByPlaceholder('Название события');
    const addBtn = page.getByRole('button', { name: 'Событие', exact: true });
    await expect(addBtn).toBeVisible({ timeout: 15_000 });
    const before = await titles.count();

    await addBtn.click();
    await expect(titles).toHaveCount(before + 1, { timeout: 10_000 });
    await titles.last().fill('Падение Тестовой Ворны');

    await page.getByRole('link', { name: 'Заметки', exact: true }).click();
    await expect(page).toHaveURL(/\/notes/, { timeout: 10_000 });
    await page.waitForTimeout(3500) // дать удалению дойти до сервера и сброситься в сохранённый кэш;

    await page.goto(bookHref + '/timeline');
    await expect(addBtn).toBeVisible({ timeout: 15_000 });
    await expect(titles).toHaveCount(before + 1);
  });
});
