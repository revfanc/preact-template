import path from 'node:path';
import { expect, test } from '@playwright/test';
import { preview, type PreviewServer } from 'vite';
import { createLandingFixture } from '../helpers/landing';

let fixture: Awaited<ReturnType<typeof createLandingFixture>>;
let server: PreviewServer;
let origin: string;

test.beforeAll(async () => {
  fixture = await createLandingFixture({ channel: true });
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

test('hydrates channel links, preserves context on navigation, and isolates explicit channel changes and history', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (['fetch', 'xhr'].includes(request.resourceType()))
      requests.push(request.url());
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/*.js', async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto(
      `${origin}/campaign/channel/?channelCode=A&undertakePageConfigId=10&clickid=ad&linkId=link&token=private`,
      { waitUntil: 'commit' },
    );
    await expect(page.getByTestId('context')).toHaveText('null');
    await expect(page.getByTestId('same')).not.toHaveAttribute('href');
    await expect(page.getByRole('button')).toBeDisabled();
    const original = await page.locator('main').elementHandle();
    release();
    const a = {
      channelCode: 'A',
      undertakePageConfigId: '10',
      clickid: 'ad',
      linkId: 'link',
    };
    await expect(page.getByTestId('context')).toHaveText(JSON.stringify(a));
    expect(
      await original!.evaluate(
        (node) => node === document.querySelector('main'),
      ),
    ).toBe(true);
    await expect(page.getByRole('button')).toBeEnabled();
    await page.evaluate(() =>
      document.body.setAttribute('data-session', 'same'),
    );
    await page.getByTestId('same').click();
    await expect(page).toHaveURL(/\/campaign\/channel-next\/\?channelCode=A/);
    expect(new URL(page.url()).searchParams.has('token')).toBe(false);
    await expect(page.locator('body')).toHaveAttribute('data-session', 'same');
    await expect(page.getByTestId('context')).toHaveText(JSON.stringify(a));
    await page.getByTestId('change').click();
    await expect(page.getByTestId('context')).toHaveText('{"channelCode":"B"}');
    expect(new URL(page.url()).search).toBe('?channelCode=B');
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('context')).toHaveText(JSON.stringify(a));
    await page.goForward({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('context')).toHaveText('{"channelCode":"B"}');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('context')).toHaveText('{"channelCode":"B"}');
    await page.getByRole('button').click();
    await expect(page).toHaveURL(/step=2&channelCode=B#form$/);
    const tab = await context.newPage();
    try {
      await tab.goto(`${origin}/campaign/channel/?channelCode=C`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(tab.getByTestId('context')).toHaveText(
        '{"channelCode":"C"}',
      );
      await expect(page.getByTestId('context')).toHaveText(
        '{"channelCode":"B"}',
      );
    } finally {
      await tab.close();
    }
    await page.getByTestId('clear').click();
    await expect(page.getByTestId('context')).toHaveText('null');
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    release();
  }
});

test('does not recover a missing channel from storage and disables context links for ambiguous input', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('channelCode', 'old');
    sessionStorage.setItem('channelCode', 'old');
  });
  await page.goto(`${origin}/campaign/channel/`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.getByRole('button')).toBeEnabled();
  await expect(page.getByTestId('context')).toHaveText('null');
  await expect(page.getByTestId('same')).toHaveAttribute(
    'href',
    '/campaign/channel-next/',
  );
  await page.goto(`${origin}/campaign/channel/?channelCode=A&channelCode=B`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.getByTestId('error')).toContainText('channelCode');
  await expect(page.getByTestId('context')).toHaveText('null');
  await expect(page.getByTestId('same')).not.toHaveAttribute('href');
  await expect(page.getByRole('button')).toBeDisabled();
});
