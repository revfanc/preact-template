import path from 'node:path';
import { expect, test } from '@playwright/test';
import { preview, type PreviewServer } from 'vite';
import { createLandingFixture } from '../helpers/landing';

test.describe.configure({ mode: 'default' });

let fixture: Awaited<ReturnType<typeof createLandingFixture>>;
let server: PreviewServer;
let origin: string;

test.beforeAll(async () => {
  fixture = await createLandingFixture();
  server = await preview({
    configFile: path.join(fixture.directory, 'vite.config.ts'),
    mode: 'prod',
    preview: { port: 0, strictPort: false },
  });
  const address = server.httpServer.address();
  if (!address || typeof address === 'string')
    throw new Error('Missing preview port');
  origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  try {
    if (server)
      await new Promise<void>((resolve, reject) =>
        server.httpServer.close((error) => (error ? reject(error) : resolve())),
      );
  } finally {
    await fixture?.cleanup();
  }
});

test('prerendered pages hydrate without replacing the first screen, then navigate as an SPA', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\.(?:js|css)$/, async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto(`${origin}/campaign/`, { waitUntil: 'commit' });
    const main = page.locator('main');
    await expect(page.getByRole('heading')).toHaveText('静态首屏');
    expect(
      await main.evaluate((node) => parseFloat(getComputedStyle(node).padding)),
    ).toBeCloseTo(17, 2);
    await expect(main).toHaveCSS('border-top-color', 'rgb(255, 0, 0)');
    expect(
      await main.evaluate((node) =>
        parseFloat(getComputedStyle(node).borderTopWidth),
      ),
    ).toBeCloseTo(3, 2);
    await expect(page.locator('body')).toHaveCSS('margin', '0px');
    const bounds = await main.boundingBox();
    const original = await main.elementHandle();
    await expect(page.getByRole('button')).toBeDisabled();
    release();
    await expect(page.getByRole('button')).toBeEnabled();
    expect(
      await original!.evaluate(
        (node) => node === document.querySelector('main'),
      ),
    ).toBe(true);
    expect(await main.boundingBox()).toEqual(bounds);
    await expect(page.locator('.pkg-ui-loading')).toHaveCount(0);
    await page.getByRole('button').click();
    await expect(page.getByRole('button')).toHaveText('计数 1');
    await page.evaluate(() =>
      document.body.setAttribute('data-session', 'same'),
    );
    let finishRoute!: () => void;
    const pendingRoute = new Promise<void>((resolve) => {
      finishRoute = resolve;
    });
    await page.route('**/offer-*.js', async (route) => {
      await pendingRoute;
      await route.continue();
    });
    try {
      await page.getByRole('link', { name: '活动', exact: true }).click();
      await expect(page.locator('.pkg-ui-loading')).toBeVisible();
    } finally {
      finishRoute();
    }
    await expect(page.getByRole('heading')).toHaveText('预渲染活动');
    await expect(main).toHaveCSS('border-top-color', 'rgb(0, 0, 255)');
    await expect(page.locator('body')).toHaveAttribute('data-session', 'same');
    await page.goBack();
    await page.getByRole('link', { name: '客户端页面' }).click();
    await expect(main).toHaveCSS('color', 'rgb(12, 34, 56)');
    await expect(page.locator('body')).toHaveAttribute('data-session', 'same');
    await page.getByRole('link', { name: '首页', exact: true }).click();
    await page.getByRole('link', { name: '动态页' }).click();
    await expect(page.getByRole('heading')).toHaveText('动态 7');
    await expect(page.locator('main p')).toHaveText('A');
    await expect(page.locator('body')).toHaveAttribute('data-session', 'same');
    await page.reload();
    await expect(page.getByRole('heading')).toHaveText('动态 7');
    // Exercise the recommended deployment fallback, independently of Vite's index fallback.
    await page.route('**/campaign/detail/9?channel=B', async (route) => {
      const response = await route.fetch({
        url: `${origin}/campaign/200.html`,
      });
      await route.fulfill({ response });
    });
    await page.goto(`${origin}/campaign/detail/9?channel=B`);
    await expect(page.getByRole('heading')).toHaveText('动态 9');
    await expect(page.locator('main p')).toHaveText('B');
    expect(errors).toEqual([]);
  } finally {
    release();
  }
});

test('nested prerendered page is styled without JavaScript or external CSS', async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 812 },
  });
  try {
    const page = await context.newPage();
    await page.route('**/*.css', (route) => route.abort());
    await page.goto(`${origin}/campaign/offer/`);
    await expect(page.getByRole('heading')).toHaveText('预渲染活动');
    expect(
      await page
        .locator('main')
        .evaluate((node) => parseFloat(getComputedStyle(node).padding)),
    ).toBeCloseTo(17, 2);
    await expect(page.locator('main')).toHaveCSS(
      'border-top-color',
      'rgb(0, 0, 255)',
    );
    await expect(page.locator('main')).toHaveCSS(
      'background-image',
      `url("${origin}/campaign/banner.svg")`,
    );
  } finally {
    await context.close();
  }
});

test('optional and catch-all routes match empty and populated paths after refresh', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const [route, heading] of [
    ['optional', '可选 空'],
    ['optional/', '可选 空'],
    ['optional/7', '可选 7'],
    ['optional/7/', '可选 7'],
    ['files', '捕获 空'],
    ['files/', '捕获 空'],
    ['files/a/%E4%B8%AD%E6%96%87', '捕获 a/中文'],
    ['files/a/b/', '捕获 a/b'],
    ['unknown/nested', '页面不存在'],
  ]) {
    await page.goto(`${origin}/campaign/${route}`);
    await expect(page.getByRole('heading')).toHaveText(heading!);
    await page.reload();
    await expect(page.getByRole('heading')).toHaveText(heading!);
  }
  expect(errors).toEqual([]);
});
