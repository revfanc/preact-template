import { beforeEach, expect, it, vi } from 'vitest';
import { request } from '@/request';
import { getExample } from './example';

vi.mock('@/request', () => ({ request: vi.fn() }));
beforeEach(() => {
  vi.mocked(request).mockReset();
});

it('passes parameters and cancellation options and returns validated data', async () => {
  const data = { id: '1', title: '示例内容' };
  vi.mocked(request).mockResolvedValue({ code: 200, data });
  const controller = new AbortController();
  await expect(
    getExample({ id: '1' }, { signal: controller.signal, timeout: 5000 }),
  ).resolves.toEqual(data);
  expect(request).toHaveBeenCalledWith('/__example__/detail', {
    method: 'GET',
    query: { id: '1' },
    signal: controller.signal,
    timeout: 5000,
  });
});

it('rejects business failures and malformed responses without treating them as success', async () => {
  vi.mocked(request).mockResolvedValueOnce({ code: 400, data: null });
  await expect(getExample({ id: '1' })).rejects.toThrow('业务失败');
  for (const response of [
    undefined,
    'invalid json',
    { code: '200' },
    { code: 200, data: { id: 1, title: '示例' } },
  ]) {
    vi.mocked(request).mockResolvedValueOnce(response);
    await expect(getExample({ id: '1' })).rejects.toThrow('响应格式不正确');
  }
});

it('preserves request errors for the owning flow to handle', async () => {
  const error = new Error('request failed');
  vi.mocked(request).mockRejectedValue(error);
  await expect(getExample({ id: '1' })).rejects.toBe(error);
});
