import { expect, it, vi } from 'vitest';
import { createLoadingStore } from './index';

it('manages loading state without UI and ignores repeated transitions or updates after disposal', () => {
  const store = createLoadingStore();
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
