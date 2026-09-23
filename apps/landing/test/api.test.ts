import { expect, it, vi } from 'vitest';
import { createApi } from './fixture/src/api/fixture-api';
import { createRequestClient } from '@packages/request';

it('can import the real application client during prerender without making a request', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch');
  try {
    const { request } = await import('../src/lib/request');
    expect(typeof request).toBe('function');
    expect(typeof request.raw).toBe('function');
    await expect(request('/config')).rejects.toThrow('预渲染');
    expect(fetcher).not.toHaveBeenCalled();
  } finally {
    fetcher.mockRestore();
  }
});

it('uses the configured endpoint and rejects malformed configuration', async () => {
  const config = {
    title: '欢迎',
    description: '示例内容',
    companyName: '示例服务方',
  };
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json(config))
    .mockResolvedValueOnce(Response.json({ title: 123 }));
  vi.stubGlobal('window', {
    fetch,
    Request,
    Headers,
    AbortController,
    location: { href: 'https://example.test/' },
  });
  const api = createApi(
    createRequestClient({ baseURL: '/api' }, { fetch: fetcher }),
    { configPath: 'config' },
  );
  try {
    await expect(api.getConfig()).resolves.toEqual(config);
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/config');
    await expect(api.getConfig()).rejects.toThrow('站点配置格式不正确');
  } finally {
    vi.unstubAllGlobals();
  }
});
