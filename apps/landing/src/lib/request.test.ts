import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FetchError } from '@packages/request';
import {
  BusinessError,
  ResponseFormatError,
  request,
  type ApiResponse,
} from './request';

const fetcher = vi.fn<typeof fetch>();
beforeEach(() => {
  fetcher.mockReset();
  vi.stubGlobal('window', {
    fetch: fetcher,
    Request,
    Headers,
    AbortController,
    location: { href: 'https://example.test/' },
  });
});
afterEach(() => vi.unstubAllGlobals());

it('returns the complete success envelope without extracting or validating data', async () => {
  const body = {
    code: 200,
    message: 'ok',
    data: { siteId: 42 },
    trace: 'trace-1',
  };
  fetcher.mockResolvedValue(Response.json(body));
  await expect(
    request<ApiResponse<{ siteId: number }>>('/example'),
  ).resolves.toEqual(body);
});

it.each([{ code: 200 }, { code: 200, data: null }])(
  'allows absent or null payloads: %j',
  async (body) => {
    fetcher.mockResolvedValue(Response.json(body));
    await expect(request('/example')).resolves.toEqual(body);
  },
);

it('preserves business code, message and data, including flow-specific failures', async () => {
  const body = {
    code: 40301,
    message: '需要验证码',
    data: { challenge: 'example' },
  };
  fetcher.mockResolvedValue(Response.json(body));
  const result = request('/example');
  await expect(result).rejects.toBeInstanceOf(BusinessError);
  await expect(result).rejects.toMatchObject({
    name: 'BusinessError',
    code: body.code,
    message: body.message,
    data: body.data,
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('provides a fallback message for a business failure without a message', async () => {
  fetcher.mockResolvedValue(Response.json({ code: 400 }));
  await expect(request('/example')).rejects.toMatchObject({
    name: 'BusinessError',
    code: 400,
    message: '业务请求失败，code=400',
    data: undefined,
  });
});

it.each(
  [
    null,
    [],
    {},
    'invalid',
    { code: '200' },
    { code: 200, message: 1 },
    { code: 200, message: null },
  ].map((body) => [body]),
)('rejects an invalid response envelope: %j', async (body) => {
  fetcher.mockResolvedValue(Response.json(body));
  await expect(request('/example')).rejects.toBeInstanceOf(ResponseFormatError);
});

it('rejects an empty successful HTTP response without a business envelope', async () => {
  fetcher.mockResolvedValue(new Response(null, { status: 204 }));
  await expect(request('/example')).rejects.toBeInstanceOf(ResponseFormatError);
});

it('validates raw responses through the same instance hook', async () => {
  fetcher.mockResolvedValueOnce(Response.json({ code: 200, data: 'ok' }));
  expect((await request.raw('/example'))._data).toEqual({
    code: 200,
    data: 'ok',
  });
  fetcher.mockResolvedValueOnce(Response.json({ code: 400 }));
  await expect(request.raw('/example')).rejects.toBeInstanceOf(BusinessError);
});

it('preserves HTTP errors even when the response is not a business envelope', async () => {
  fetcher.mockResolvedValue(
    new Response('upstream unavailable', { status: 503 }),
  );
  const result = request('/example');
  await expect(result).rejects.toBeInstanceOf(FetchError);
  await expect(result).rejects.toMatchObject({
    status: 503,
    data: 'upstream unavailable',
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
