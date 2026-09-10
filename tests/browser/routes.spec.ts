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
  await page.goto('/landing/');
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
  await page.goto('/landing/result?name=%E5%B0%8F%E6%98%8E');
  await expect(page.getByText('你好，小明')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '欢迎语结果' })).toBeVisible();
  await page.goto('/landing/detail/%E4%B8%AD%E6%96%87');
  await expect(page.getByText('内容编号：中文')).toBeVisible();
  await page.reload();
  await expect(page.getByText('内容编号：中文')).toBeVisible();
  await page.goto('/landing/does-not-exist');
  await expect(page.getByRole('heading', { name: '页面不存在' })).toBeVisible();
  await page.getByRole('button', { name: '返回首页' }).click();
  await expect(page.getByLabel('你的称呼')).toBeVisible();
});

test('failed page chunks show a retry and release the loading indicator', async ({
  page,
}) => {
  await page.goto('/landing/');
  await expect(page.getByRole('link', { name: '查看结果页' })).toBeVisible();
  await page.route('**/assets/result-*.js', (route) => route.abort());
  await page.getByRole('link', { name: '查看结果页' }).click();
  await expect(
    page.getByRole('heading', { name: '页面加载失败' }),
  ).toBeVisible();
  await expect(page.locator('.pkg-ui-loading')).toHaveCount(0);
  await expect(page.getByRole('status', { name: '正在加载页面' })).toHaveCount(
    0,
  );
  await page.unroute('**/assets/result-*.js');
  await page.screenshot({ path: 'test-results/page-error.png' });
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 812 });
    await expect(
      page.getByRole('button', { name: '重新加载页面' }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
  await page.getByRole('button', { name: '重新加载页面' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: '欢迎语结果' })).toBeVisible();
});

test('initial HTML shows animated dots before application scripts load and hands over to the app', async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let completedScripts = 0;
  page.on('requestfinished', (request) => {
    if (request.resourceType() === 'script') completedScripts++;
  });
  await page.route('**/*.js', async (route) => {
    await gate;
    await route.continue();
  });
  let releaseConfig!: () => void;
  const configGate = new Promise<void>((resolve) => {
    releaseConfig = resolve;
  });
  await page.route('**/site-config.json', async (route) => {
    await configGate;
    await route.continue();
  });
  try {
    await page.goto('/landing/', { waitUntil: 'commit' });
    const indicator = page.getByRole('status', { name: '正在加载页面' });
    await expect(indicator).toBeVisible();
    await expect(indicator).toHaveCSS('color', 'rgb(22, 99, 72)');
    await expect(indicator.locator('.pkg-ui-dots span')).toHaveCount(3);
    const originalDot = await indicator
      .locator('.pkg-ui-dots span')
      .first()
      .elementHandle();
    expect(completedScripts).toBe(0);
    const first = indicator.locator('.pkg-ui-dots span').first();
    const position = await first.evaluate(
      (dot) => getComputedStyle(dot).transform,
    );
    await expect
      .poll(() => first.evaluate((dot) => getComputedStyle(dot).transform))
      .not.toBe(position);
    await expect(page.locator('html')).toHaveCSS(
      'background-color',
      'rgb(243, 244, 239)',
    );
    await page.screenshot({ path: 'test-results/initial-page-loading.png' });
    release();
    await expect(page.getByLabel('你的称呼')).toBeVisible();
    await expect(page.locator('.pkg-ui-notice')).toHaveCount(1);
    expect(
      await originalDot!.evaluate(
        (dot) => dot === document.querySelector('.pkg-ui-dots span'),
      ),
    ).toBe(true);
    await expect(page.locator('.pkg-ui-loading')).toBeVisible();
    await expect(page.locator('.pkg-ui-loading')).toHaveCSS(
      'color',
      'rgb(22, 99, 72)',
    );
  } finally {
    release();
    releaseConfig();
  }
  await expect(page.locator('footer')).toContainText('示例服务提供方');
  await expect(page.getByRole('status', { name: '正在加载页面' })).toHaveCount(
    0,
  );
});

test('initial loading paints while external CSS and scripts are still pending', async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let completed = 0;
  page.on('requestfinished', (request) => {
    if (['script', 'stylesheet'].includes(request.resourceType())) completed++;
  });
  await page.route('**/*', async (route) => {
    if (['script', 'stylesheet'].includes(route.request().resourceType()))
      await gate;
    await route.continue();
  });
  try {
    await page.goto('/landing/browser', { waitUntil: 'commit' });
    // DOM visibility alone does not prove that the browser has painted pixels.
    await expect
      .poll(
        () =>
          page.evaluate(
            () => performance.getEntriesByName('first-paint').length,
          ),
        { timeout: 3000 },
      )
      .toBe(1);
    expect(completed).toBe(0);
    await expect(
      page.getByRole('status', { name: '正在加载页面' }),
    ).toBeVisible();
    await page.screenshot({ path: 'test-results/initial-loading-paint.png' });
  } finally {
    release();
  }
  await expect(
    page.getByRole('heading', { name: '返回拦截体验' }),
  ).toBeVisible();
  await expect(page.locator('.pkg-ui-loading')).toHaveCount(0);
});

test('disabled JavaScript shows guidance instead of an endless startup animation', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173/landing/');
    expect(await page.locator('noscript').textContent()).toContain(
      '请启用 JavaScript',
    );
    await expect(page.locator('.pkg-ui-layer')).toBeHidden();
  } finally {
    await context.close();
  }
});

test('route loading shows three bouncing dots until the page chunk arrives', async ({
  page,
}) => {
  await page.goto('/landing/');
  await expect(page.locator('footer')).toContainText('示例服务提供方');
  await expect(page.locator('.pkg-ui-loading')).toHaveCount(0);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/assets/result-*.js', async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.getByRole('link', { name: '查看结果页' }).click();
    const indicator = page.getByRole('status', { name: '正在加载页面' });
    await expect(indicator).toBeVisible();
    await expect(indicator.locator('.pkg-ui-dots span')).toHaveCount(3);
    await expect(page.locator('.pkg-ui-loading')).toHaveCount(1);
    await expect(page.locator('.pkg-ui-mask')).toHaveCSS(
      'pointer-events',
      'auto',
    );
    await page.evaluate(() => {
      const button = document.createElement('button');
      button.id = 'background-test-button';
      button.textContent = '背景按钮';
      button.style.cssText =
        'position:fixed;top:0;left:0;width:100px;height:40px;z-index:1';
      button.dataset.clicks = '0';
      button.onclick = () => {
        button.dataset.clicks = String(Number(button.dataset.clicks) + 1);
      };
      document.body.appendChild(button);
    });
    await page.mouse.click(30, 20);
    await expect(page.locator('#background-test-button')).toHaveAttribute(
      'data-clicks',
      '0',
    );
    await expect(page.getByLabel('你的称呼')).toBeHidden();
    const dots = indicator.locator('.pkg-ui-dots span');
    await expect(dots.nth(0)).toHaveCSS('animation-duration', '0.9s');
    await expect(dots.nth(1)).toHaveCSS('animation-delay', '0.15s');
    await expect(dots.nth(2)).toHaveCSS('animation-delay', '0.3s');
    const firstPosition = await dots
      .first()
      .evaluate((dot) => getComputedStyle(dot).transform);
    await expect
      .poll(() =>
        dots.first().evaluate((dot) => getComputedStyle(dot).transform),
      )
      .not.toBe(firstPosition);
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 812 });
      const group = await indicator.locator('.pkg-ui-dots').boundingBox();
      expect(group!.x + group!.width / 2).toBeCloseTo(width / 2, 0);
      expect(group!.y + group!.height / 2).toBeCloseTo(406, 0);
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: 'test-results/page-loading.png' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(dots.first()).toHaveCSS('animation-name', 'none');
  } finally {
    release();
  }
  await expect(page.getByRole('heading', { name: '欢迎语结果' })).toBeVisible();
  await expect(page.locator('.pkg-ui-mask')).toHaveCount(0);
  await page.mouse.click(30, 20);
  await expect(page.locator('#background-test-button')).toHaveAttribute(
    'data-clicks',
    '1',
  );
  await expect(page.getByRole('status', { name: '正在加载页面' })).toHaveCount(
    0,
  );
});
