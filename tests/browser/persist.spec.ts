import { expect, test, type Page } from '@playwright/test';

async function open(page: Page, storage: 'session' | 'local', channel = 'A') {
  await page.goto(
    `http://127.0.0.1:4176/landing/persist.html?storage=${storage}&channel=${channel}`,
  );
  await page.waitForFunction(() => Boolean(window.persistenceFixture));
}

async function snapshot(page: Page) {
  return page.evaluate(() => window.persistenceFixture.store.getSnapshot());
}

async function update(page: Page, name: string) {
  await page.evaluate((name) => {
    window.persistenceFixture.store.update(() => ({ name, pending: true }));
  }, name);
}

test('session persistence survives refresh and stays independent in another tab', async ({
  page,
  context,
}) => {
  const second = await context.newPage();
  await open(page, 'session');
  await open(second, 'session');
  await update(page, 'Alice');
  await update(second, 'Bob');
  await open(page, 'session');
  await open(second, 'session');
  expect(await snapshot(page)).toEqual({ name: 'Alice', pending: false });
  expect(await snapshot(second)).toEqual({ name: 'Bob', pending: false });
});

test('local persistence keeps channel keys separate and supports stop and clear', async ({
  page,
  context,
}) => {
  const second = await context.newPage();
  await open(page, 'local', 'A');
  await open(second, 'local', 'B');
  await update(page, 'Alice');
  await update(second, 'Bob');
  await page.evaluate(() => window.persistenceFixture.persistence.dispose());
  await update(page, 'not saved');
  await open(page, 'local', 'A');
  await open(second, 'local', 'B');
  expect(await snapshot(page)).toEqual({ name: 'Alice', pending: false });
  expect(await snapshot(second)).toEqual({ name: 'Bob', pending: false });
  await page.evaluate(() => window.persistenceFixture.persistence.clear());
  await open(page, 'local', 'A');
  await open(second, 'local', 'B');
  expect(await snapshot(page)).toEqual({ name: '', pending: false });
  expect(await snapshot(second)).toEqual({ name: 'Bob', pending: false });
});

test('blocked browser storage keeps the store usable in memory', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() {
        throw new DOMException('Storage denied', 'SecurityError');
      },
    });
  });
  await open(page, 'session');
  await update(page, 'Alice');
  expect(await snapshot(page)).toEqual({ name: 'Alice', pending: true });
  expect(
    await page.evaluate(() => window.persistenceFixture.errors.length),
  ).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('persistence works without Object.fromEntries', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Object, 'fromEntries', {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });
  const boot = async () => {
    await page.goto(
      'http://127.0.0.1:4176/landing/persist.html?storage=session',
    );
    await page.waitForFunction(() => Boolean(window.persistenceFixture));
  };
  await boot();
  await update(page, 'Alice');
  await boot();
  expect(await snapshot(page)).toEqual({ name: 'Alice', pending: false });
  expect(await page.evaluate(() => window.persistenceFixture.errors)).toEqual(
    [],
  );
});
