import { expect, test } from '@playwright/test';

test('production landing is empty, makes no example request and keeps its responsive shell', async ({
  page,
}) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/landing/');
  await expect(page.getByRole('main', { name: '落地页' })).toBeVisible();
  await expect(page.locator('.pkg-ui-loading')).toHaveCount(0);
  await expect(page.getByRole('main')).toBeEmpty();
  for (const width of [320, 375, 540, 1024]) {
    await page.setViewportSize({ width, height: 812 });
    const box = await page.getByRole('main').boundingBox();
    expect(box!.width).toBeCloseTo(Math.min(width, 540), 0);
  }
  expect(requests.some((url) => /site-config|browser-|result-/.test(url))).toBe(
    false,
  );
  expect(errors).toEqual([]);
});

test('removed example routes show 404 and return to the empty home', async ({
  page,
}) => {
  for (const path of ['browser', 'result', 'detail/1']) {
    await page.goto('/landing/' + path);
    await expect(
      page.getByRole('heading', { name: '页面不存在' }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('heading', { name: '页面不存在' }),
    ).toBeVisible();
  }
  await page.getByRole('button', { name: '返回首页' }).click();
  await expect(page.getByRole('main', { name: '落地页' })).toBeVisible();
});

test('production initial loading paints before JS and CSS, then releases', async ({
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
    await expect(page.locator('.pkg-ui-dots span')).toHaveCount(3);
    await expect(
      page.getByRole('status', { name: '正在加载页面' }),
    ).toBeVisible();
  } finally {
    release();
  }
  await expect(page.getByRole('main', { name: '落地页' })).toBeVisible();
  await expect(page.locator('.pkg-ui-loading')).toHaveCount(0);
});

test('static agreement is readable without JS and no example data is published', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173/agreement/');
    await expect(
      page.getByRole('heading', { name: '协议', exact: true }),
    ).toBeVisible();
    await expect(page.locator('h1')).toHaveCSS('font-size', '28px');
    await expect(page.locator('body')).toHaveCSS('margin', '0px');
    await expect(page.locator('main')).toHaveCSS('padding', '32px 24px');
    await expect(
      page.locator('#company-name, #display-name, #retry-config'),
    ).toHaveCount(0);
    expect(await page.locator('body').textContent()).not.toContain('示例');
  } finally {
    await context.close();
  }
});

test('agreement style is stable before and after its classic entry and refresh', async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.route('**/runtime/agreement.js', async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto('/agreement/', { waitUntil: 'commit' });
    await expect(page.locator('h1')).toHaveCSS('font-size', '28px');
    const bounds = await page.locator('h1').boundingBox();
    release();
    await page.waitForLoadState('load');
    expect(await page.locator('h1').boundingBox()).toEqual(bounds);
    await page.reload();
    expect(await page.locator('h1').boundingBox()).toEqual(bounds);
    expect(requests.some((url) => url.includes('site-config.json'))).toBe(
      false,
    );
  } finally {
    release();
  }
});
