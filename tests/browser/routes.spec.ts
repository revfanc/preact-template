import { expect, test } from '@playwright/test';

test('file routes lazy-load and navigate using browser history without reloading the document', async ({
  page,
}) => {
  const documents: string[] = [];
  const scripts: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.resourceType() === 'document') documents.push(request.url());
    if (request.resourceType() === 'script') scripts.push(request.url());
  });
  await page.goto('/');
  await expect(page.locator('footer')).toContainText('示例服务提供方');
  expect(scripts.some((url) => /\/result-[^/]+\.js$/.test(url))).toBe(false);
  await page.getByLabel('你的称呼').fill('小明');
  await page.getByRole('link', { name: '查看结果页' }).locator('span').click();
  await expect(page.getByRole('heading', { name: '欢迎语结果' })).toBeVisible();
  await expect(page.getByText('你好，小明')).toBeVisible();
  expect(scripts.some((url) => /\/result-[^/]+\.js$/.test(url))).toBe(true);
  await page.getByRole('link', { name: '查看详情示例' }).click();
  await expect(page.getByText('内容编号：1')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: '欢迎语结果' })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading', { name: '详情示例' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: '欢迎语结果' })).toBeVisible();
  const historyLength = await page.evaluate(() => history.length);
  await page.getByRole('button', { name: '返回首页' }).click();
  await expect(page.getByLabel('你的称呼')).toBeVisible();
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  expect(documents).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('deep links, query values, dynamic parameters and 404 survive a refresh', async ({
  page,
}) => {
  await page.goto('/result?name=%E5%B0%8F%E6%98%8E');
  await expect(page.getByText('你好，小明')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '欢迎语结果' })).toBeVisible();
  await page.goto('/detail/%E4%B8%AD%E6%96%87');
  await expect(page.getByText('内容编号：中文')).toBeVisible();
  await page.reload();
  await expect(page.getByText('内容编号：中文')).toBeVisible();
  await page.goto('/does-not-exist');
  await expect(page.getByRole('heading', { name: '页面不存在' })).toBeVisible();
  await page.getByRole('button', { name: '返回首页' }).click();
  await expect(page.getByLabel('你的称呼')).toBeVisible();
});

test('failed page chunks show a retry and release the loading indicator', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: '查看结果页' })).toBeVisible();
  await page.route('**/assets/result-*.js', (route) => route.abort());
  await page.getByRole('link', { name: '查看结果页' }).click();
  await expect(
    page.getByRole('heading', { name: '页面加载失败' }),
  ).toBeVisible();
  await expect(page.locator('.pkg-ui-loading')).toHaveCount(0);
  await page.unroute('**/assets/result-*.js');
  await page.getByRole('button', { name: '重新加载页面' }).click();
  await expect(page.getByRole('heading', { name: '欢迎语结果' })).toBeVisible();
});
