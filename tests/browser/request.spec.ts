import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import type { FetchError } from '../../packages/request/src/index';

// Send headers before the body to distinguish a complete-request deadline from fetch-only timeout.
const server = createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'x-client');
  if (request.method === 'OPTIONS') {
    response.end();
    return;
  }
  response.setHeader('Content-Type', 'application/json');
  response.write('{"value":');
  const timer = setTimeout(() => response.end('1}'), 500);
  response.on('close', () => clearTimeout(timer));
});
let bodyUrl: string;
test.beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Missing test port');
  bodyUrl = `http://127.0.0.1:${address.port}/body`;
});
test.afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

for (const mode of ['native', 'no-abort', 'no-fetch'] as const) {
  test(`request transport works with ${mode}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript((mode) => {
      const missing =
        mode === 'no-fetch'
          ? [
              'fetch',
              'Request',
              'Response',
              'Headers',
              'AbortController',
              'AbortSignal',
            ]
          : mode === 'no-abort'
            ? ['AbortController', 'AbortSignal']
            : [];
      for (const name of missing)
        Object.defineProperty(window, name, {
          value: undefined,
          configurable: true,
          writable: true,
        });
    }, mode);
    let submitted = 0;
    await page.route('**/__request/echo', async (route) => {
      submitted++;
      await route.fulfill({
        json: {
          body: route.request().postDataJSON(),
          client: route.request().headers()['x-client'],
          contentType: route.request().headers()['content-type'],
        },
      });
    });
    let failed = 0;
    await page.route('**/__request/error', (route) => {
      failed++;
      return route.fulfill({
        status: 503,
        headers: { 'x-request-id': 'trace' },
        json: { code: 'INVALID' },
      });
    });
    await page.route('**/__request/slow', () => {});
    await page.goto('http://127.0.0.1:4176/landing/request.html');
    await page.waitForFunction(() => Boolean(window.requestFixture));
    expect(
      await page.evaluate(() =>
        window.requestFixture.client('/echo', {
          method: 'POST',
          body: { value: 1 },
        }),
      ),
    ).toEqual({
      body: { value: 1 },
      client: 'fixture',
      contentType: 'application/json',
    });
    expect(submitted).toBe(1);
    expect(
      await page.evaluate(async () => {
        try {
          await window.requestFixture.client('/error');
        } catch (error) {
          const value = error as FetchError;
          return {
            name: value.name,
            status: value.status,
            data: value.data,
            trace: value.response?.headers.get('x-request-id'),
          };
        }
      }),
    ).toEqual({
      name: 'FetchError',
      status: 503,
      data: { code: 'INVALID' },
      trace: 'trace',
    });
    expect(failed).toBe(1);
    expect(
      await page.evaluate(async () => {
        try {
          await window.requestFixture.client('/slow', {
            timeout: 100,
          });
        } catch (error) {
          const value = error as FetchError;
          return {
            name: value.name,
            cause: (value as Error & { cause?: Error }).cause?.name,
          };
        }
      }),
    ).toEqual({
      name: 'FetchError',
      cause: 'TimeoutError',
    });
    expect(
      await page.evaluate(async () => {
        const controller = window.requestFixture.createController();
        try {
          await window.requestFixture.client('/slow', {
            signal: controller.signal,
            timeout: 100,
          });
        } catch (error) {
          return {
            cause: (error as Error & { cause?: Error }).cause?.name,
            cancelled: controller.signal.aborted,
          };
        }
      }),
    ).toEqual({ cause: 'TimeoutError', cancelled: false });
    expect(
      await page.evaluate(async (url) => {
        try {
          await window.requestFixture.client(url, { timeout: 100 });
        } catch (error) {
          return (error as Error & { cause?: Error }).cause?.name;
        }
      }, bodyUrl),
    ).toBe('TimeoutError');
    expect(
      await page.evaluate(async () => {
        const controller = window.requestFixture.createController();
        const pending = window.requestFixture.client('/slow', {
          signal: controller.signal,
        });
        controller.abort();
        try {
          await pending;
        } catch (error) {
          const value = error as FetchError;
          return {
            name: value.name,
            cause: (value as Error & { cause?: Error }).cause?.name,
          };
        }
      }),
    ).toEqual({ name: 'FetchError', cause: 'AbortError' });
    expect(errors).toEqual([]);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });
}
