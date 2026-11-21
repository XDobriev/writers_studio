import { test, expect } from '@playwright/test';

const viewports = [
  [320, 568], [360, 640], [375, 667], [390, 844], [412, 915],
  [479, 800], [480, 800], [568, 320], [639, 800], [640, 800],
  [667, 375], [767, 1024], [768, 1024], [769, 1024], [844, 390],
  [1023, 768], [1024, 600], [1024, 768], [1280, 720], [1366, 768],
  [1440, 900], [1920, 1080], [2560, 1440], [3840, 2160],
];

for (const [width, height] of viewports) {
  test(`demo toolbar link stays clickable and within viewport (${width}x${height})`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height });
    // Demo state is in memory; prevent every external request, including database calls.
    await page.route('**/*', (route) =>
      new URL(route.request().url()).origin === new URL(baseURL!).origin
        ? route.continue()
        : route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
    await page.addInitScript(() => localStorage.setItem('cookie_consent_v1', 'rejected'));
    await page.goto('/demo');
    await expect(page.locator('.tiptap')).toBeVisible();
    await page.getByRole('button', { name: 'Ссылка', exact: true }).click();
    const input = page.getByRole('textbox', { name: 'Адрес ссылки' });
    await expect(input).toBeVisible();
    const popup = await input.locator('..').boundingBox();
    expect(popup).not.toBeNull();
    expect(popup!.x).toBeGreaterThanOrEqual(8);
    expect(popup!.x + popup!.width).toBeLessThanOrEqual(width - 8);
    expect(popup!.y).toBeGreaterThanOrEqual(0);
    expect(popup!.y + popup!.height).toBeLessThanOrEqual(height);
  });
}
