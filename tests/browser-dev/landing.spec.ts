import { expect, test } from '@playwright/test';

test('dev renders the SPA and clears route loading', async ({ page }) => {
  await page.goto('/landing/p1/p2026091101/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('慢下来');
  await expect(page.locator('.pkg-ui-loading')).toHaveCount(0);
  await expect(page.locator('html')).toHaveCSS(
    'background-color',
    'rgb(243, 244, 239)',
  );
});
