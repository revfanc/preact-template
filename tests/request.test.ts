import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest';
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

beforeEach(() =>
  vi.stubGlobal('window', {
    fetch,
    Request,
    Headers,
    AbortController,
    location: { href: 'https://example.test/' },
  }),
);
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

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
      'createAbortController',
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

  it('keeps the timeout active with a caller signal without aborting the caller controller', async () => {
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
      cause: { name: 'TimeoutError' },
    });
    await vi.advanceTimersByTimeAsync(101);
    await pending;
    expect(controller.signal.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    controller.abort();
    await expect(
      request('/cancelled', { signal: controller.signal }),
    ).rejects.toBeInstanceOf(FetchError);
  });

  it('times out while reading the response body and releases its timer', async () => {
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
    const onResponse = vi.fn();
    const request = createRequestClient(
      { timeout: 100, onResponse },
      { fetch: vi.fn<typeof fetch>().mockResolvedValue(response) },
    );
    const pending = expect(
      request('/slow-body', { responseType: 'text' }),
    ).rejects.toMatchObject({
      name: 'FetchError',
      cause: { name: 'TimeoutError' },
    });
    await started;
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(101);
    await pending;
    release('body');
    await vi.advanceTimersByTimeAsync(0);
    expect(onResponse).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('allows creation in Node but rejects every execution path before hooks or transport', async () => {
    vi.unstubAllGlobals();
    const fetcher = vi.fn<typeof fetch>();
    const hook = vi.fn();
    const request = createRequestClient(
      { onRequest: hook },
      { fetch: fetcher },
    );
    for (const execute of [
      () => request('/item'),
      () => request.raw('/item'),
      () => request.native('/item'),
      () => request.create({})('/item'),
    ])
      await expect(execute()).rejects.toThrow('预渲染');
    expect(fetcher).not.toHaveBeenCalled();
    expect(hook).not.toHaveBeenCalled();
  });

  it('cancels without retrying and removes listeners on success and failure', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options!.signal!.addEventListener('abort', () =>
            reject(options!.signal!.reason),
          );
        }),
    );
    const request = createRequestClient({ retry: 2 }, { fetch: fetcher });
    const pending = expect(
      request('/slow', { signal: controller.signal }),
    ).rejects.toMatchObject({
      name: 'FetchError',
      cause: { name: 'AbortError' },
    });
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await pending;
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    const active = new AbortController();
    const cleanup = vi.spyOn(active.signal, 'removeEventListener');
    fetcher.mockResolvedValueOnce(Response.json({ ok: true }));
    await request('/done', { signal: active.signal });
    expect(cleanup).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses one deadline for retries, with request overrides and timeout zero', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
      return Response.json({}, { status: 503 });
    });
    const request = createRequestClient({ timeout: 1000 }, { fetch: fetcher });
    const pending = expect(
      request.raw('/retry', { timeout: 100, retry: 3 }),
    ).rejects.toMatchObject({
      name: 'FetchError',
      cause: { name: 'TimeoutError' },
    });
    await vi.advanceTimersByTimeAsync(100);
    await pending;
    await vi.advanceTimersByTimeAsync(100);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
    fetcher.mockResolvedValueOnce(Response.json({ ok: true }));
    await expect(request.create({ timeout: 0 })('/item')).resolves.toEqual({
      ok: true,
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not send pre-cancelled requests and isolates concurrent calls', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      async (_url, options) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => resolve(Response.json({ ok: true })),
            50,
          );
          options?.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error('aborted'));
          });
        }),
    );
    const request = createRequestClient({ timeout: 10 }, { fetch: fetcher });
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(
      request('/pre', { signal: cancelled.signal }),
    ).rejects.toMatchObject({ cause: { name: 'AbortError' } });
    expect(fetcher).not.toHaveBeenCalled();
    const slow = expect(request('/timeout')).rejects.toMatchObject({
      cause: { name: 'TimeoutError' },
    });
    const other = request.create({ timeout: 0 })('/success');
    await vi.advanceTimersByTimeAsync(60);
    await slow;
    await expect(other).resolves.toEqual({ ok: true });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves hook override/array semantics, accepts hook timeout configuration and cleans up thrown response hooks', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const cleanup = vi.spyOn(controller.signal, 'removeEventListener');
    const defaultHook = vi.fn();
    const calls: string[] = [];
    const cause = new Error('response hook failed');
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json({ ok: true }));
    const request = createRequestClient(
      { onRequest: defaultHook },
      { fetch: fetcher },
    );
    await expect(
      request('/item', {
        onRequest: [
          () => {
            calls.push('one');
          },
          ({ options }) => {
            calls.push('two');
            options.signal = controller.signal;
            options.timeout = 20;
          },
        ],
        onResponse() {
          throw cause;
        },
      }),
    ).rejects.toBe(cause);
    expect(defaultHook).not.toHaveBeenCalled();
    expect(calls).toEqual(['one', 'two']);
    expect(cleanup).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
