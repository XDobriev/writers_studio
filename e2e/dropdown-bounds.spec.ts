import { test, expect } from '@playwright/test';

// Тестирование инварианта: ни один дропдаун в приложении никогда не обрезается
// за границами видимой области экрана (viewport) независимо от положения кнопки и высоты экрана.

test.describe('Геометрические границы выпадающих меню (Viewport Bounds)', () => {
  const VIEWPORTS = [
    { name: 'Ноутбук 720p', width: 1280, height: 720 },
    { name: 'Компактный экран 600p', width: 1024, height: 600 },
  ];

  for (const vp of VIEWPORTS) {
    test(`меню последней главы сайдбара открывается вверх и не уходит за нижний край экрана (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/demo');

      // Ждём загрузки интерфейса сайдбара
      const lastStatusBtn = page.locator('div:has(> button:has-text("Тишина в Корне")) button[aria-label^="Статус главы"]');
      await expect(lastStatusBtn).toBeVisible({ timeout: 15_000 });

      // Кликаем по статусу последней главы в списке
      await lastStatusBtn.click();

      // Находим открытое выпадающее меню
      const menu = page.locator('div[style*="position: fixed"]:has(button:has-text("Пролог"))');
      await expect(menu).toBeVisible({ timeout: 5_000 });

      const box = await menu.boundingBox();
      expect(box, 'Выпадающее меню должно иметь координаты на экране').not.toBeNull();

      if (box) {
        // Верхний край меню не должен быть выше экрана
        expect(box.y).toBeGreaterThanOrEqual(0);
        // Нижний край меню строго не должен превышать высоту окна (никакого ухода за таскбар!)
        expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
        // Правый край меню не выходит за пределы экрана
        expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
        // Меню должно полностью отображать свои пункты
        await expect(menu.getByRole('button', { name: /Пролог/i })).toBeVisible();
        await expect(menu.getByRole('button', { name: /Интерлюдия/i })).toBeVisible();
      }
    });

    test(`меню первой главы сайдбара открывается вниз и не уходит за пределы экрана (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/demo');

      const firstStatusBtn = page.locator('div:has(> button:has-text("Город, которого нет")) button[aria-label^="Статус главы"]');
      await expect(firstStatusBtn).toBeVisible({ timeout: 15_000 });

      await firstStatusBtn.click();

      const menu = page.locator('div[style*="position: fixed"]:has(button:has-text("Пролог"))');
      await expect(menu).toBeVisible({ timeout: 5_000 });

      const box = await menu.boundingBox();
      expect(box).not.toBeNull();

      if (box) {
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
        expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
      }
    });
  }
});
