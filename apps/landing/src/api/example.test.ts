import { beforeEach, expect, it, vi } from 'vitest';
import { request } from '@/request';
import { getExample } from './example';

vi.mock('@/request', () => ({ request: vi.fn() }));
beforeEach(() => {
  vi.mocked(request).mockReset();
});

it('passes parameters and cancellation options and returns the request promise directly', async () => {
  const response = { code: 200, data: { id: '1', title: '示例内容' } };
  const pending = Promise.resolve(response);
  vi.mocked(request).mockReturnValue(pending);
  const controller = new AbortController();
  const result = getExample(
    { id: '1' },
    { signal: controller.signal, timeout: 5000 },
  );
  expect(result).toBe(pending);
  await expect(result).resolves.toBe(response);
  expect(request).toHaveBeenCalledWith('/__example__/detail', {
    method: 'GET',
    query: { id: '1' },
    signal: controller.signal,
    timeout: 5000,
  });
});

it('does not add business status handling on top of the request instance', async () => {
  const response = { code: 400, data: null };
  vi.mocked(request).mockResolvedValue(response);
  await expect(getExample({ id: '1' })).resolves.toBe(response);
});

it('preserves request errors for the owning flow to handle', async () => {
  const error = new Error('request failed');
  vi.mocked(request).mockRejectedValue(error);
  await expect(getExample({ id: '1' })).rejects.toBe(error);
});
