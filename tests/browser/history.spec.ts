import { chromium, expect, test, type Page } from '@playwright/test';

const origin = 'http://127.0.0.1:4175';
async function kind(page: Page) {
  return page.evaluate(
    () => history.state?.__packages_browser__?.kind as string | undefined,
  );
}
async function back(page: Page) {
  await page.evaluate(() => history.back());
}
async function forward(page: Page) {
  await page.evaluate(() => history.forward());
}

test('native Back consumes the top and keeps the lower layer protected', async ({
  page,
}) => {
  await page.goto(origin);
  await page.getByRole('button').click();
  const length = await page.evaluate(() => history.length);
  await page.evaluate(() => {
    window.browserFixture.add('lower');
    window.browserFixture.add('middle');
    window.browserFixture.add('upper', 'defer');
  });
  expect(await page.evaluate(() => history.length)).toBe(length + 1);
  await page.evaluate(() => window.browserFixture.remove('middle'));
  await back(page);
  await expect
    .poll(() => page.evaluate(() => window.browserFixture.status().calls))
    .toEqual(['upper']);
  await expect.poll(() => kind(page)).toBe('guard');
  await back(page);
  await expect.poll(() => kind(page)).toBe('guard');
  expect(
    await page.evaluate(() => window.browserFixture.status().calls),
  ).toEqual(['upper']);
  await page.evaluate(() => window.browserFixture.allow());
  expect(await kind(page)).toBe('guard');
  await page.evaluate(() => window.browserFixture.remove('upper'));
  await back(page);
  await expect
    .poll(() => page.evaluate(() => window.browserFixture.status().calls))
    .toEqual(['upper', 'lower']);
  await page.evaluate(() => window.browserFixture.remove('lower'));
  expect(await kind(page)).toBe('base');
  expect(
    await page.evaluate(() => window.browserFixture.status().errors),
  ).toEqual([]);
});

test('refresh adopts the guard and final unregister confirms native traversal', async ({
  page,
}) => {
  await page.goto(`${origin}/?auto=hold`);
  const initial = await page.evaluate(() => window.browserFixture.status());
  for (let i = 0; i < 3; i++) {
    await page.reload();
    await expect.poll(() => kind(page)).toBe('guard');
    expect(
      await page.evaluate(() => window.browserFixture.status().length),
    ).toBe(initial.length);
    expect(
      await page.evaluate(() => window.browserFixture.status().state),
    ).toEqual(initial.state);
  }
  await page.evaluate(() => window.browserFixture.remove('page'));
  expect(await kind(page)).toBe('base');
});

test('a/a+ and b/b+ return across documents, then re-registering at a truncates forward b', async ({
  page,
}) => {
  await page.goto(`${origin}/away.html`);
  await page.getByRole('link', { name: '进入 a' }).click();
  await expect.poll(() => kind(page)).toBe('guard');
  const aState = await page.evaluate(() => history.state);
  await page.goto(`${origin}/?name=b&auto=allow`);
  await expect.poll(() => kind(page)).toBe('guard');
  await back(page);
  await expect
    .poll(() => page.evaluate(() => window.browserFixture.status().completed))
    .toBe(1);
  expect(await kind(page)).toBe('base');
  await back(page);
  await expect(page).toHaveURL(`${origin}/?name=a&auto=allow`);
  await expect.poll(() => kind(page)).toBe('guard');
  expect(await page.evaluate(() => history.state)).toEqual(aState);
  await back(page);
  await expect.poll(() => kind(page)).toBe('base');
  await back(page);
  await expect(page.getByRole('heading')).toHaveText('Previous document');
  await forward(page);
  await expect(page).toHaveURL(`${origin}/?name=a&auto=allow`);
  await expect.poll(() => kind(page)).toBe('guard');
  const session = await page.context().newCDPSession(page);
  const entries = await session.send('Page.getNavigationHistory');
  expect(entries.entries[entries.currentIndex]!.url).toBe(
    `${origin}/?name=a&auto=allow`,
  );
  expect(entries.entries.slice(entries.currentIndex + 1)).toEqual([]);
  await session.detach();
});

test('leaving during an async decision expires the old done without pulling the new page back', async ({
  page,
}) => {
  await page.goto(origin);
  await page.evaluate(() => window.browserFixture.add('page', 'defer'));
  await back(page);
  await expect
    .poll(() => page.evaluate(() => window.browserFixture.status().calls))
    .toEqual(['page']);
  await expect.poll(() => kind(page)).toBe('guard');
  const result = await page.evaluate(async () => {
    history.pushState({ page: 'other' }, '', '/?other');
    try {
      await window.browserFixture.allow();
      return 'unexpected success';
    } catch (error) {
      return (error as Error).name;
    }
  });
  expect(result).toBe('AbortError');
  await expect(page).toHaveURL(`${origin}/?other`);
  await page.evaluate(() => window.browserFixture.remove('page'));
  expect(await page.evaluate(() => history.state)).toEqual({ page: 'other' });
});

test('legacy fixture restores and releases without native Promise', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'Promise', {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });
  await page.route(`${origin}/**`, async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    const body = (await response.text())
      .replace(/<script\b[^>]*\btype="module"[^>]*>[\s\S]*?<\/script>/g, '')
      .replace(/\snomodule\b/g, '');
    await route.fulfill({ response, body });
  });
  await page.goto(`${origin}/?auto=allow`);
  await page.evaluate(async () => {
    const system = (
      window as unknown as { System: { import(url: string): Promise<unknown> } }
    ).System;
    await system.import(
      document.getElementById('vite-legacy-entry')!.getAttribute('data-src')!,
    );
  });
  await expect.poll(() => kind(page)).toBe('guard');
  await back(page);
  await expect
    .poll(() => page.evaluate(() => window.browserFixture.status().completed))
    .toBe(1);
  expect(await kind(page)).toBe('base');
  expect(
    await page.evaluate(() => window.browserFixture.status().errors),
  ).toEqual([]);
});

test('BFCache restore re-registers the page and never revives its old done', async () => {
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    ignoreDefaultArgs: ['--disable-back-forward-cache'],
  });
  try {
    const page = await browser.newPage();
    await page.goto(`${origin}/?auto=defer`);
    await back(page);
    await expect
      .poll(() => page.evaluate(() => window.browserFixture.status().calls))
      .toEqual(['page']);
    await expect.poll(() => kind(page)).toBe('guard');
    const original = await page.evaluate(() => history.state);
    await page.getByRole('link', { name: '离开文档' }).click();
    const length = await page.evaluate(() => history.length);
    await page.goBack({ waitUntil: 'commit', timeout: 5000 });
    await expect
      .poll(() =>
        page.evaluate(() => window.browserFixture.status().restoredFromCache),
      )
      .toBe(true);
    expect(await page.evaluate(() => history.state)).toEqual(original);
    expect(await page.evaluate(() => history.length)).toBe(length);
    expect(
      await page.evaluate(async () => {
        try {
          await window.browserFixture.allow();
          return '';
        } catch (error) {
          return (error as Error).name;
        }
      }),
    ).toBe('AbortError');
    await back(page);
    await expect
      .poll(() => page.evaluate(() => window.browserFixture.status().calls))
      .toEqual(['page', 'page']);
    await page.evaluate(() => window.browserFixture.allow());
    expect(await kind(page)).toBe('base');
  } finally {
    await browser.close();
  }
});
