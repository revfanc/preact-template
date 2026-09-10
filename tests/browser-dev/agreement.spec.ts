import { expect, test } from '@playwright/test';

test('agreement dev redirect and refresh keep static styles without example requests', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/agreement/');
  await expect(page).toHaveURL(/:5174\/agreement\//);
  await expect(
    page.getByRole('heading', { name: '协议', exact: true }),
  ).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('font-size', '16px');
  await expect(page.locator('h1')).toHaveCSS('font-size', '28px');
  const bounds = await page.locator('h1').boundingBox();
  await page.reload();
  await expect(page.locator('h1')).toHaveCSS('font-size', '28px');
  expect(await page.locator('h1').boundingBox()).toEqual(bounds);
  expect(requests.some((url) => url.includes('site-config'))).toBe(false);
});
