import { expect, it, vi } from 'vitest';
import { createRouteStore } from './index';

it('manages route state without UI and ignores repeated transitions or updates after disposal', () => {
  const store = createRouteStore();
  const notify = vi.fn();
  store.subscribe(notify);
  store.start();
  store.start();
  expect(notify).toHaveBeenCalledTimes(1);
  expect(store.getSnapshot().isLoading).toBe(true);
  store.finish();
  store.finish();
  expect(notify).toHaveBeenCalledTimes(2);
  store.start();
  store.dispose();
  store.dispose();
  store.start();
  expect(notify).toHaveBeenCalledTimes(4);
  expect(store.getSnapshot().isLoading).toBe(false);
});
