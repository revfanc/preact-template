import { chromium, expect, test } from '@playwright/test';

test('landing demonstrates stacked Back handlers and done stops on the demo page', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/landing/');
  await page.getByRole('link', { name: '体验返回拦截' }).click();
  await expect(
    page.getByRole('heading', { name: '返回拦截体验' }),
  ).toBeVisible();
  await expect(page.getByText('已注册 1 层')).toBeVisible();
  const length = await page.evaluate(() => history.length);
  await page.getByRole('button', { name: '添加一层拦截' }).click();
  await expect(page.getByText('已注册 2 层')).toBeVisible();
  expect(await page.evaluate(() => history.length)).toBe(length);
  await expect(page.locator('.pkg-ui-loading')).toHaveCount(0);
  await page.screenshot({
    path: 'test-results/browser-demo.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: '模拟返回' }).click();
  const confirm = page.getByRole('dialog', { name: '第 2 层拦截' });
  await expect(confirm).toBeVisible();
  await expect(confirm).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'test-results/browser-confirm.png' });
  await confirm.getByRole('button', { name: '留在页面' }).click();
  await expect(confirm).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('第 2 层保留了本次返回');
  await page.getByRole('button', { name: '移除第 2 层' }).click();
  await page.evaluate(() => history.back());
  const lower = page.getByRole('dialog', { name: '第 1 层拦截' });
  await expect(lower).toBeVisible();
  await lower.getByRole('button', { name: '放行本次返回' }).click();
  await expect(page.getByRole('status')).toContainText('已放行本次返回');
  await expect(page).toHaveURL(/\/landing\/browser$/);
  await page.evaluate(() => history.back());
  await expect(page.getByLabel('你的称呼')).toBeVisible();
  await expect(page.locator('[data-modal-root]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('landing Back demo runs through the legacy entry without native Promise', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'Promise', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    const body = (await response.text())
      .replace(/<script\b[^>]*\btype="module"[^>]*>[\s\S]*?<\/script>/g, '')
      .replace(/\snomodule\b/g, '');
    await route.fulfill({ response, body });
  });
  await page.goto('/landing/browser');
  await page.evaluate(async () => {
    const system = (
      window as unknown as { System: { import(url: string): Promise<unknown> } }
    ).System;
    await system.import(
      document.getElementById('vite-legacy-entry')!.getAttribute('data-src')!,
    );
  });
  await expect(page.getByText('已注册 1 层')).toBeVisible();
  await page.getByRole('button', { name: '模拟返回' }).click();
  await page.getByRole('button', { name: '放行本次返回' }).click();
  await expect(page.getByRole('status')).toContainText('已放行本次返回');
  expect(errors).toEqual([]);
});

test('BFCache restores demo registrations and closes its old confirmation', async () => {
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    ignoreDefaultArgs: ['--disable-back-forward-cache'],
  });
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:4173/landing/browser');
    await page.evaluate(() => {
      window.addEventListener('pageshow', (event) => {
        document.body.dataset.cached = String(event.persisted);
      });
    });
    await page.getByRole('button', { name: '添加一层拦截' }).click();
    await page.getByRole('button', { name: '模拟返回' }).click();
    await expect(
      page.getByRole('dialog', { name: '第 2 层拦截' }),
    ).toBeVisible();
    await page.goto('http://127.0.0.1:4175/away.html');
    await page.goBack({ waitUntil: 'commit', timeout: 5000 });
    await expect(page.locator('body')).toHaveAttribute('data-cached', 'true');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('已注册 2 层')).toBeVisible();
    await page.getByRole('button', { name: '模拟返回' }).click();
    await expect(
      page.getByRole('dialog', { name: '第 2 层拦截' }),
    ).toBeVisible();
    await page.getByRole('button', { name: '放行本次返回' }).click();
    await expect(page.getByRole('status')).toContainText('已放行本次返回');
  } finally {
    await browser.close();
  }
});

test('refresh reuses the entry and returning home awaits cleanup', async ({
  page,
}) => {
  await page.goto('/landing/browser');
  await expect(page.getByText('已注册 1 层')).toBeVisible();
  const length = await page.evaluate(() => history.length);
  await page.reload();
  await expect(page.getByText('已注册 1 层')).toBeVisible();
  expect(await page.evaluate(() => history.length)).toBe(length);
  await page.getByRole('button', { name: '添加一层拦截' }).click();
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await expect(page.getByLabel('你的称呼')).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: '返回拦截体验' }),
  ).toBeVisible();
  await expect(page.getByText('已注册 1 层')).toBeVisible();
  await page.getByRole('button', { name: '模拟返回' }).click();
  await expect(page.getByRole('dialog', { name: '第 1 层拦截' })).toBeVisible();
});

test('removing middle registrations and closing all leaves no active callback', async ({
  page,
}) => {
  await page.goto('/landing/browser');
  await expect(page.getByText('已注册 1 层')).toBeVisible();
  await page.getByRole('button', { name: '添加一层拦截' }).click();
  await page.getByRole('button', { name: '添加一层拦截' }).click();
  await page.getByRole('button', { name: '移除第 2 层' }).click();
  await page.getByRole('button', { name: '模拟返回' }).click();
  await expect(page.getByRole('dialog', { name: '第 3 层拦截' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '关闭全部拦截' }).click();
  await expect(page.getByText('已注册 0 层')).toBeVisible();
  await expect(page.getByRole('button', { name: '模拟返回' })).toBeDisabled();
  await page.getByRole('button', { name: '添加一层拦截' }).click();
  await expect(page.getByText('已注册 1 层')).toBeVisible();
  for (const width of [320, 540]) {
    await page.setViewportSize({ width, height: 812 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
