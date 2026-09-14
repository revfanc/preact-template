import path from 'node:path';
import { expect, test } from '@playwright/test';
import { preview, type PreviewServer } from 'vite';
import { createAgreementFixture } from '../helpers/agreement';

let fixture: Awaited<ReturnType<typeof createAgreementFixture>>;
let server: PreviewServer;
let origin: string;

test.beforeAll(async () => {
  fixture = await createAgreementFixture();
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

test('agreement hydrates the original DOM and handles events', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() === 'script') await gate;
    await route.continue();
  });
  try {
    await page.goto(`${origin}/legal/terms/`, { waitUntil: 'commit' });
    const button = page.getByRole('button');
    await expect(button).toHaveText('计数 0');
    await expect(button).toBeDisabled();
    const original = await button.elementHandle();
    const bounds = await page.locator('h1').boundingBox();
    release();
    await expect(button).toBeEnabled();
    expect(
      await original!.evaluate(
        (node) => node === document.querySelector('button'),
      ),
    ).toBe(true);
    expect(await page.locator('h1').boundingBox()).toEqual(bounds);
    await button.click();
    await expect(button).toHaveText('计数 1');
    await expect(page).toHaveTitle('条款 & <说明>');
    await page.reload();
    await expect(button).toBeEnabled();
    await button.click();
    await expect(button).toHaveText('计数 1');
    expect(errors).toEqual([]);
  } finally {
    release();
  }
});
