import { expect, test } from '@playwright/test';

test('opening and refreshing an agreement from landing keeps document styles stable', async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let releaseConfig!: () => void;
  const configGate = new Promise<void>((resolve) => {
    releaseConfig = resolve;
  });
  await page.route('**/site-config.json', async (route) => {
    await configGate;
    await route.continue();
  });
  await page.route('**/runtime/agreement.js', async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto('/agreement/', { waitUntil: 'commit' });
    await expect(page.locator('body')).toHaveCSS('font-size', '16px');
    await expect(page.locator('h1')).toHaveCSS('font-size', '28px');
    await expect(page.locator('main a')).toBeVisible();
    const heading = await page.locator('h1').boundingBox();
    const link = await page.locator('main a').boundingBox();
    release();
    await expect(page.locator('.pkg-ui-loading')).toBeVisible();
    await expect(page.locator('body')).toHaveCSS('font-size', '16px');
    expect(await page.locator('main a').boundingBox()).toEqual(link);
    releaseConfig();
    await expect(page.locator('#company-name')).toHaveText('示例服务提供方');
    await expect(page.locator('body')).toHaveCSS('font-size', '16px');
    expect(await page.locator('h1').boundingBox()).toEqual(heading);
    expect(await page.locator('main a').boundingBox()).toEqual(link);
    await page.reload();
    await expect(page.locator('#company-name')).toHaveText('示例服务提供方');
    await expect(page.locator('body')).toHaveCSS('font-size', '16px');
    await page.goto('/');
    await page.getByRole('link', { name: '阅读示例协议' }).click();
    await expect(page.locator('#company-name')).toHaveText('示例服务提供方');
    await expect(page.locator('body')).toHaveCSS('font-size', '16px');
  } finally {
    release();
    releaseConfig();
  }
});
