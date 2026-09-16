import { expect, test } from '@playwright/test';

test('dev renders the SPA and clears route loading', async ({ page }) => {
  await page.goto('/landing/');
  await expect(page.getByRole('main', { name: '落地页' })).toBeVisible();
  await expect(page.locator('.pkg-ui-loading')).toHaveCount(0);
  await expect(page.locator('html')).toHaveCSS(
    'background-color',
    'rgb(243, 244, 239)',
  );
});
