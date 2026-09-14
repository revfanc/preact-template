import { expect, test } from '@playwright/test';
import type { FetchError } from '../../packages/request/src/index';

for (const mode of ['native', 'no-abort', 'no-fetch', 'legacy'] as const) {
  test(`request transport works with ${mode}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript((mode) => {
      const missing =
        mode === 'no-fetch' || mode === 'legacy'
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
      if (mode === 'legacy') missing.push('Promise', 'URL', 'URLSearchParams');
      for (const name of missing)
        Object.defineProperty(window, name, {
          value: undefined,
          configurable: true,
          writable: true,
        });
    }, mode);
    if (mode === 'legacy') {
      await page.route('**/request.html', async (route) => {
        const response = await route.fetch();
        const body = (await response.text())
          .replace(/<script\b[^>]*\btype="module"[^>]*>[\s\S]*?<\/script>/g, '')
          .replace(/\snomodule\b/g, '');
        await route.fulfill({ response, body });
      });
    }
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
    if (mode === 'legacy') {
      await page.evaluate(async () => {
        const system = (
          window as unknown as {
            System: { import(url: string): Promise<unknown> };
          }
        ).System;
        await system.import(
          document
            .getElementById('vite-legacy-entry')!
            .getAttribute('data-src')!,
        );
      });
    }
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
      cause: mode === 'native' ? 'TimeoutError' : 'AbortError',
    });
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
