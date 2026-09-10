import { expect, test } from '@playwright/test';

test('dev startup paints before scripts and clears loading after routing', async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/*', async (route) => {
    if (['script', 'stylesheet'].includes(route.request().resourceType()))
      await gate;
    await route.continue();
  });
  try {
    await page.goto('/landing/', { waitUntil: 'commit' });
    await expect
      .poll(() =>
        page.evaluate(() => performance.getEntriesByName('first-paint').length),
      )
      .toBe(1);
    const loading = page.getByRole('status', { name: '正在加载页面' });
    await expect(loading).toHaveCSS('color', 'rgb(22, 99, 72)');
    await expect(loading.locator('.pkg-ui-dots span')).toHaveCount(3);
    await expect(page.locator('html')).toHaveCSS(
      'background-color',
      'rgb(243, 244, 239)',
    );
  } finally {
    release();
  }
  await expect(page.getByRole('main', { name: '落地页' })).toBeVisible();
  await expect(page.locator('.pkg-ui-loading')).toHaveCount(0);
});
