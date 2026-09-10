import { expect, it, vi } from 'vitest';
import { createStore } from './create-store';

it('isolates instances and keeps snapshots stable until an immutable update', () => {
  const first = createStore({ count: 0 });
  const second = createStore({ count: 0 });
  const snapshot = first.getSnapshot();
  const notify = vi.fn();
  first.subscribe(notify);
  first.update((state) => state);
  expect(first.getSnapshot()).toBe(snapshot);
  expect(notify).not.toHaveBeenCalled();
  first.update((state) => ({ count: state.count + 1 }));
  expect(first.getSnapshot()).toEqual({ count: 1 });
  expect(snapshot).toEqual({ count: 0 });
  expect(second.getSnapshot()).toEqual({ count: 0 });
  expect(notify).toHaveBeenCalledTimes(1);
});

it('unsubscribes one consumer without destroying others and ignores late updates after dispose', () => {
  const store = createStore({ count: 0 });
  const first = vi.fn();
  const second = vi.fn();
  const unsubscribe = store.subscribe(first);
  store.subscribe(second);
  unsubscribe();
  unsubscribe();
  store.update(() => ({ count: 1 }));
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
  store.dispose();
  store.dispose();
  store.subscribe(first);
  store.update(() => ({ count: 2 }));
  expect(store.getSnapshot()).toEqual({ count: 1 });
  expect(second).toHaveBeenCalledTimes(1);
  expect(first).not.toHaveBeenCalled();
});
