import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  createRequestClient,
  FetchError,
  type $Fetch,
  type CreateFetchOptions,
  type FetchContext,
  type FetchHook,
  type FetchOptions,
  type ResponseType,
} from '../packages/request/src/index';
import * as requestExports from '../packages/request/src/index';

afterEach(() => vi.useRealTimers());

describe('ofetch request client', () => {
  it('exports upstream types while keeping runtime entry points explicit', () => {
    expectTypeOf<
      ReturnType<typeof createRequestClient>
    >().toEqualTypeOf<$Fetch>();
    expectTypeOf<Parameters<FetchHook>[0]>().toEqualTypeOf<FetchContext>();
    expectTypeOf<FetchOptions['responseType']>().toEqualTypeOf<
      ResponseType | undefined
    >();
    expectTypeOf<Parameters<typeof createRequestClient>[1]>().toEqualTypeOf<
      Omit<CreateFetchOptions, 'defaults'> | undefined
    >();
    expect(Object.keys(requestExports).sort()).toEqual([
      'FetchError',
      'createRequestClient',
    ]);
  });

  it('exposes the callable client, raw responses and derived instances', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json({ id: 1 }));
    const request = createRequestClient(
      { baseURL: '/api' },
      { fetch: fetcher },
    );
    const result = request<{ id: number }>('/item');
    expectTypeOf(result).toEqualTypeOf<Promise<{ id: number }>>();
    await expect(result).resolves.toEqual({ id: 1 });
    const response = await request.raw('/item');
    expect(response.status).toBe(200);
    expect(response._data).toEqual({ id: 1 });
    await request.create({ baseURL: '/other' })('/item');
    expect(fetcher.mock.calls[2]?.[0]).toBe('/other/item');
  });

  it('uses ofetch body/query options and explicit same-origin credentials', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ ok: true }));
    const request = createRequestClient(
      { baseURL: '/api/' },
      { fetch: fetcher },
    );
    await expect(
      request('/orders?source=web', {
        method: 'POST',
        query: { channel: 'a b&c', count: 0 },
        body: { count: 1 },
      }),
    ).resolves.toEqual({ ok: true });
    const [url, options] = fetcher.mock.calls[0]!;
    const parsed = new URL(String(url), 'https://example.test');
    expect(parsed.pathname).toBe('/api/orders');
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      source: 'web',
      channel: 'a b&c',
      count: '0',
    });
    expect(options).toMatchObject({
      method: 'POST',
      body: '{"count":1}',
      credentials: 'same-origin',
    });
    expect(new Headers(options?.headers).get('content-type')).toBe(
      'application/json',
    );
  });

  it('preserves absolute URLs and allows request headers and hooks to override defaults', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response('done'));
    let token = 'first';
    const request = createRequestClient(
      {
        baseURL: '/api',
        headers: { 'X-Client': 'default' },
        onRequest({ options }) {
          options.headers.set('authorization', token);
        },
      },
      { fetch: fetcher },
    );
    await request('https://other.example.test/items', {
      headers: { 'x-client': 'override' },
    });
    token = 'second';
    await request('/items');
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://other.example.test/items');
    expect(
      new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('x-client'),
    ).toBe('override');
    expect(
      new Headers(fetcher.mock.calls[1]?.[1]?.headers).get('authorization'),
    ).toBe('second');
  });

  it('keeps HTTP error data and headers without automatically retrying GET or POST', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () =>
      Response.json(
        { code: 'UNAVAILABLE' },
        {
          status: 503,
          headers: { 'x-request-id': 'trace' },
        },
      ),
    );
    const request = createRequestClient({}, { fetch: fetcher });
    for (const method of ['GET', 'POST'] as const) {
      try {
        await request('/error', { method });
        expect.fail('HTTP error must reject');
      } catch (error) {
        expect(error).toBeInstanceOf(FetchError);
        const value = error as FetchError;
        expect(value.status).toBe(503);
        expect(value.data).toEqual({ code: 'UNAVAILABLE' });
        expect(value.response?.headers.get('x-request-id')).toBe('trace');
      }
    }
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('keeps the original network cause and does not retry', async () => {
    const cause = new TypeError('offline');
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(cause);
    await expect(
      createRequestClient({}, { fetch: fetcher })('/offline'),
    ).rejects.toMatchObject({ name: 'FetchError', cause });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('lets callers opt into retries explicitly', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({}, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    await expect(
      createRequestClient({}, { fetch: fetcher })('/items', { retry: 1 }),
    ).resolves.toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('uses ofetch response parsing and leaves business validation to the API', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('plain text'))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response('invalid json', {
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(Response.json({ code: 'BUSINESS_FAILED' }));
    const request = createRequestClient({}, { fetch: fetcher });
    const result = request('/text', { responseType: 'text' });
    expectTypeOf(result).toEqualTypeOf<Promise<string>>();
    await expect(result).resolves.toBe('plain text');
    await expect(request('/empty')).resolves.toBeUndefined();
    await expect(request('/invalid')).resolves.toBe('invalid json');
    await expect(request('/business')).resolves.toEqual({
      code: 'BUSINESS_FAILED',
    });
  });

  it('does not misclassify serialization or hook exceptions as HTTP errors', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const request = createRequestClient({}, { fetch: fetcher });
    const body: { self?: unknown } = {};
    body.self = body;
    await expect(
      request('/items', { method: 'POST', body }),
    ).rejects.toBeInstanceOf(TypeError);
    const cause = new Error('hook failed');
    await expect(
      request('/items', {
        onRequest() {
          throw cause;
        },
      }),
    ).rejects.toBe(cause);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('applies the default timeout and clears its timer', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | null | undefined;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          signal = options?.signal;
          signal?.addEventListener('abort', () => reject(signal?.reason));
        }),
    );
    const request = createRequestClient({}, { fetch: fetcher });
    const pending = expect(request('/slow')).rejects.toMatchObject({
      name: 'FetchError',
      cause: { name: 'TimeoutError' },
    });
    await vi.advanceTimersByTimeAsync(9999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(signal?.aborted).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses caller-owned cancellation when signal is supplied, following ofetch v1', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          const signal = options?.signal;
          if (signal?.aborted) reject(signal.reason);
          else
            signal?.addEventListener('abort', () => reject(signal.reason), {
              once: true,
            });
        }),
    );
    const request = createRequestClient({ timeout: 100 }, { fetch: fetcher });
    const pending = expect(
      request('/slow', { signal: controller.signal }),
    ).rejects.toMatchObject({
      name: 'FetchError',
      cause: { name: 'AbortError' },
    });
    await vi.advanceTimersByTimeAsync(101);
    expect(controller.signal.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    controller.abort();
    await pending;
    await expect(
      request('/cancelled', { signal: controller.signal }),
    ).rejects.toBeInstanceOf(FetchError);
  });

  it('ends the built-in timeout at response headers, following ofetch v1', async () => {
    vi.useFakeTimers();
    let release!: (body: string) => void;
    let reading!: () => void;
    const started = new Promise<void>((resolve) => {
      reading = resolve;
    });
    const response = new Response('body');
    vi.spyOn(response, 'text').mockImplementation(() => {
      reading();
      return new Promise((resolve) => {
        release = resolve;
      });
    });
    const request = createRequestClient(
      { timeout: 100 },
      { fetch: vi.fn<typeof fetch>().mockResolvedValue(response) },
    );
    const pending = request('/slow-body', { responseType: 'text' });
    await started;
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(101);
    release('body');
    await expect(pending).resolves.toBe('body');
  });
});
