import path from 'node:path';
import { expect, test } from '@playwright/test';
import { preview, type PreviewServer } from 'vite';
import { createLandingFixture } from '../helpers/landing';

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
  await page.route('**/*.js', async (route) => {
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
    await expect(page.locator('body')).toHaveAttribute('data-session', 'same');
    await page.goBack();
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

test('nested prerendered page is styled without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 812 },
  });
  try {
    const page = await context.newPage();
    await page.goto(`${origin}/campaign/offer/`);
    await expect(page.getByRole('heading')).toHaveText('预渲染活动');
    expect(
      await page
        .locator('main')
        .evaluate((node) => parseFloat(getComputedStyle(node).padding)),
    ).toBeCloseTo(17, 2);
  } finally {
    await context.close();
  }
});
