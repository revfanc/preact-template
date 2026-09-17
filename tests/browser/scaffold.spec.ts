import { expect, test } from '@playwright/test';

test('production activity makes no example request and keeps its responsive shell', async ({
  page,
}) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/landing/p1/p2026091101/');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.locator('.pkg-ui-loading')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('慢下来');
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

test('root and unknown routes show 404 without a home action', async ({
  page,
}) => {
  for (const path of ['', 'browser', 'result', 'detail/1']) {
    const response = await page.goto('/landing/' + path);
    expect(await response!.text()).toMatch(/<div id="app">\s*<\/div>/);
    await expect(
      page.getByRole('heading', { name: '页面不存在' }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('heading', { name: '页面不存在' }),
    ).toBeVisible();
    await expect(page.getByRole('button')).toHaveCount(0);
  }
});

test('production prerendered shell remains visible while hydration loads', async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/*.js', async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto('/landing/p1/p2026091101/', { waitUntil: 'commit' });
    const main = page.getByRole('main');
    await expect(main).toBeVisible();
    await expect(page.locator('.pkg-ui-loading')).toHaveCount(0);
    const original = await main.elementHandle();
    release();
    await page.waitForLoadState('networkidle');
    expect(
      await original!.evaluate(
        (node) => node === document.querySelector('main'),
      ),
    ).toBe(true);
    await expect(main).toBeVisible();
    await expect(page.locator('.pkg-ui-loading')).toHaveCount(0);
  } finally {
    release();
  }
});

for (const [path, title] of [
  ['privacy-policy', '隐私政策'],
  ['user-agreement', '用户协议'],
]) {
  test(`${path} is readable without JavaScript`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:4173/agreement/${path}/`);
      await expect(page).toHaveTitle(title!);
      await expect(
        page.getByRole('heading', { name: title, exact: true }),
      ).toBeVisible();
      await expect(page.locator('h1')).toHaveCSS('font-size', '28px');
      await expect(page.locator('body')).toHaveCSS('margin', '0px');
      await expect(page.locator('main')).toHaveCSS('padding', '32px 24px');
      await expect(
        page.locator('#company-name, #display-name, #retry-config'),
      ).toHaveCount(0);
      await expect(page.getByRole('heading', { level: 2 })).toHaveCount(5);
      const response = await page.request.get(
        'http://127.0.0.1:4173/agreement/',
      );
      expect(response.status()).toBe(404);
    } finally {
      await context.close();
    }
  });

  test(`${path} style is stable before and after hydration and refresh`, async ({
    page,
  }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    await page.route('**/*', async (route) => {
      if (route.request().resourceType() === 'script') await gate;
      await route.continue();
    });
    try {
      await page.goto(`/agreement/${path}/`, { waitUntil: 'commit' });
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
}
