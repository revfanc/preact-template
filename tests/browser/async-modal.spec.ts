import { expect, test } from '@playwright/test';

test.use({ baseURL: 'http://127.0.0.1:4176/landing/' });

test('keeps the overlay and focus while a real dynamic chunk loads', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/async-dialog-*.js', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/landing/async-modal.html');
  await page.getByRole('button', { name: '打开异步弹窗' }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText(
    '正在加载',
  );
  await expect(
    page.getByRole('button', { name: '取消', exact: true }),
  ).toBeFocused();
  await page
    .locator('[data-modal-overlay]')
    .evaluate((node) => node.setAttribute('data-original', 'true'));
  for (const width of [320, 540]) {
    await page.setViewportSize({ width, height: 812 });
    const box = await page.getByRole('dialog').boundingBox();
    expect(box!.width).toBeLessThanOrEqual(width - 40);
    expect(box!.width).toBe(280);
  }
  await expect(page.getByRole('dialog')).toHaveCSS('font-size', '18px');
  await page.screenshot({ path: 'test-results/async-modal-loading.png' });
  release();
  await expect(page.getByLabel('弹窗中的称呼')).toBeFocused();
  await expect(page.locator('[data-modal-overlay][data-original]')).toHaveCount(
    1,
  );
  await expect(page.locator('output')).toBeEmpty();
  await page.getByRole('button', { name: '确认称呼' }).click();
  await expect(page.locator('output')).toHaveText('异步内容');
  await expect(page.locator('[data-modal-root]')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '打开异步弹窗' }),
  ).toBeFocused();
  expect(errors).toEqual([]);
});

test('a failed chunk shows retry and close without rejecting the modal early', async ({
  page,
}) => {
  await page.route('**/async-dialog-*.js', (route) => route.abort());
  await page.goto('/landing/async-modal.html');
  await page.getByRole('button', { name: '打开异步弹窗' }).click();
  await expect(page.getByRole('alert')).toContainText('加载失败');
  await expect(page.locator('output')).toBeEmpty();
  await expect(
    page.getByRole('button', { name: '关闭', exact: true }),
  ).toBeFocused();
  await page.screenshot({ path: 'test-results/async-modal-error.png' });
  await page.getByRole('button', { name: '重试', exact: true }).click();
  // Browsers may cache module loading failures: retry is an attempt, not a guarantee.
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('[data-modal-overlay]')).toHaveCount(1);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.locator('output')).toHaveText('已取消');
  await expect(page.locator('body')).not.toHaveCSS('position', 'fixed');
});

test('closing a pending layer never mounts its late chunk or affects another layer', async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/async-dialog-*.js', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/landing/async-modal.html');
  await page.getByRole('button', { name: '打开异步弹窗' }).click();
  await page.evaluate(() => {
    window.asyncModalFixture.open();
  });
  await expect(page.locator('[data-modal-overlay]')).toHaveCount(2);
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.locator('[data-modal-overlay]')).toHaveCount(1);
  release();
  await expect(page.getByLabel('弹窗中的称呼')).toBeVisible();
  await expect(page.locator('[data-modal]')).toHaveCount(1);
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.locator('[data-modal-root]')).toHaveCount(0);
});

test('loads modal content through the legacy entry and settles normally', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/async-modal.html', async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace(/<script\b[^>]*\btype="module"[^>]*>[\s\S]*?<\/script>/g, '')
      .replace(/\snomodule\b/g, '');
    await route.fulfill({ response, body });
  });
  const chunks: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('async-dialog-legacy-'))
      chunks.push(request.url());
  });
  await page.goto('/landing/async-modal.html');
  await page.evaluate(async () => {
    const system = (
      window as unknown as { System: { import(url: string): Promise<unknown> } }
    ).System;
    await system.import(
      document.getElementById('vite-legacy-entry')!.getAttribute('data-src')!,
    );
  });
  await page.getByRole('button', { name: '打开异步弹窗' }).click();
  await expect(page.getByLabel('弹窗中的称呼')).toBeVisible();
  await page.getByRole('button', { name: '确认称呼' }).click();
  await expect(page.locator('output')).toHaveText('异步内容');
  expect(chunks.length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
