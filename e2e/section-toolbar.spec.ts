import { test, expect } from '@playwright/test';
import { loginAndGetBookHref } from './fixtures';

test('фильтры и основные действия целиком видны на узкой рабочей панели', async ({ page }) => {
  const book = await loginAndGetBookHref(page);
  const main = page.getByRole('main');
  for (const section of ['notes', 'corkboard']) {
    await page.goto(book + '/' + section);
    const header = main.locator('header');
    for (const width of [1440, 820, 769, 768, 520, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      const action = header.getByRole('button', { name: section === 'notes' ? 'Добавить заметку' : 'Новая глава' });
      await expect(action).toBeInViewport({ ratio: 1 });
      const filters = header.getByRole('group');
      const options = filters.getByRole('button');
      await expect(options).toHaveCount(section === 'notes' ? 6 : 4);
      if (section === 'corkboard' || width === 320) {
        const rows = await options.evaluateAll(buttons =>
          buttons.map(button => button.getBoundingClientRect().y),
        );
        expect(new Set(rows).size).toBe(1);
      }
      for (const option of await options.all()) {
        await expect(option).toBeInViewport({ ratio: 1 });
        if (width <= 768) {
          const bounds = await option.boundingBox();
          expect(bounds?.height).toBeGreaterThanOrEqual(44);
          expect(bounds?.width).toBeGreaterThanOrEqual(44);
        }
      }
    }
  }
  const draft = main.getByRole('group', { name: 'Фильтр глав' }).getByRole('button', { name: /Черновик/ });
  await draft.focus();
  await draft.press('Space');
  await expect(draft).toHaveAttribute('aria-pressed', 'true');
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole('link', { name: 'Структура', exact: true })).toHaveAttribute('aria-current', 'location');
});

test('создание персонажа доступно по обе стороны планшетного порога', async ({ page }) => {
  const book = await loginAndGetBookHref(page);
  await page.goto(book + '/characters');
  const main = page.getByRole('main');

  for (const width of [767, 768, 769]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(main.getByRole('button', { name: 'Новый персонаж' })).toBeInViewport({ ratio: 1 });
    if (width >= 768) {
      await expect(main.getByRole('button', { name: 'Детальная карточка' })).toBeInViewport({ ratio: 1 });
    }
  }
});
