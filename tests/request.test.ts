import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createRequestClient,
  RequestError,
} from '../packages/request/src/index';

afterEach(() => vi.useRealTimers());

describe('request client', () => {
  it('joins the API prefix, encodes queries, serializes JSON and sends explicit credentials', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ ok: true }));
    const client = createRequestClient({ baseURL: '/api/', fetch: fetcher });
    await expect(
      client.request('orders?source=web#ignored', {
        method: 'POST',
        query: { channel: 'a b&c', empty: null },
        json: { count: 1 },
      }),
    ).resolves.toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledWith(
      '/api/orders?source=web&channel=a%20b%26c',
      expect.objectContaining({
        method: 'POST',
        body: '{"count":1}',
        credentials: 'same-origin',
      }),
    );
    expect(
      new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('Content-Type'),
    ).toBe('application/json');
  });

  it('preserves custom headers without creating duplicate casing variants', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('done'));
    const client = createRequestClient({
      fetch: fetcher,
      headers: { Authorization: 'default' },
    });
    await client.request('/text', {
      headers: { authorization: 'override' },
      responseType: 'text',
    });
    expect(
      new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('authorization'),
    ).toBe('override');
  });

  it('returns undefined for 204 and reports HTTP errors before parsing JSON', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response('<html>Error</html>', { status: 503 }),
      );
    const client = createRequestClient({ fetch: fetcher });
    await expect(client.request('/empty')).resolves.toBeUndefined();
    await expect(client.request('/error')).rejects.toMatchObject({
      kind: 'http',
      status: 503,
    });
  });

  it('distinguishes invalid JSON and network errors', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('not json'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const client = createRequestClient({ fetch: fetcher });
    await expect(client.request('/bad-json')).rejects.toMatchObject({
      kind: 'parse',
    });
    await expect(client.request('/offline')).rejects.toMatchObject({
      kind: 'network',
    });
  });

  it('aborts the transport on timeout and clears its timer', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | null | undefined;
    const fetcher: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        signal = init?.signal;
        signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    const client = createRequestClient({ fetch: fetcher, timeoutMs: 100 });
    const assertion = expect(client.request('/slow')).rejects.toMatchObject({
      kind: 'timeout',
    });
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('forwards caller cancellation and never sends a pre-aborted request', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('aborted')),
          );
        }),
    );
    const client = createRequestClient({ fetch: fetcher });
    const pending = client.request('/cancel', { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ kind: 'abort' });
    await expect(
      client.request('/already-cancelled', { signal: controller.signal }),
    ).rejects.toBeInstanceOf(RequestError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
