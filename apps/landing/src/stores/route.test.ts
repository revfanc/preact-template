import { expect, it, vi } from 'vitest';
const { loading, close } = vi.hoisted(() => {
  const close = vi.fn();
  return { close, loading: vi.fn(() => close) };
});
vi.mock('@packages/feedback', () => ({ loading }));
import { createRouteStore } from './route';

it('owns one loading handle, clears it on disposal and cannot restart after disposal', () => {
  const store = createRouteStore();
  store.start();
  store.start();
  expect(loading).toHaveBeenCalledTimes(1);
  expect(store.getSnapshot().isLoading).toBe(true);
  store.finish();
  store.finish();
  expect(close).toHaveBeenCalledTimes(1);
  store.start();
  store.dispose();
  store.dispose();
  store.start();
  expect(loading).toHaveBeenCalledTimes(2);
  expect(close).toHaveBeenCalledTimes(2);
  expect(store.getSnapshot().isLoading).toBe(false);
});
