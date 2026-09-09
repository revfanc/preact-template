import { expect, it, vi } from 'vitest';
import { createApi } from '../packages/api/src/index';
import { createRequestClient } from '../packages/request/src/index';

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
  const api = createApi(
    createRequestClient({ baseURL: '/api', fetch: fetcher }),
    { configPath: 'config' },
  );
  await expect(api.getConfig()).resolves.toEqual(config);
  expect(fetcher.mock.calls[0]?.[0]).toBe('/api/config');
  await expect(api.getConfig()).rejects.toThrow('站点配置格式不正确');
});
