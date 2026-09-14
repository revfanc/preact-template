import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStore, persistStore } from './index';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
  };
}

function isDraft(value: unknown): value is { name: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string'
  );
}

function setup(storage = createStorage(), key = 'draft:A') {
  const store = createStore({ name: '', pending: false });
  const onError = vi.fn();
  const persistence = persistStore(store, {
    key,
    version: 1,
    pick: ['name'],
    storage: () => storage,
    validate: isDraft,
    onError,
  });
  return { store, persistence, storage, onError };
}

afterEach(() => vi.useRealTimers());

describe('store persistence', () => {
  it.each([
    { key: '' },
    { version: -1 },
    { version: 1.5 },
    { maxAgeMs: 0 },
    { maxAgeMs: -1 },
    { maxAgeMs: Infinity },
  ])('rejects invalid programmer configuration: %j', (override) => {
    const store = createStore({ name: '' });
    expect(() =>
      persistStore(store, {
        key: 'draft',
        version: 1,
        pick: ['name'],
        storage: () => undefined,
        validate: isDraft,
        ...override,
      }),
    ).toThrow();
  });

  it('does not write a notification already queued when persistence is disposed', () => {
    const store = createStore({ name: '' });
    const storage = createStorage();
    store.subscribe(() => handle.dispose());
    const handle = persistStore(store, {
      key: 'draft',
      version: 1,
      pick: ['name'],
      storage: () => storage,
      validate: isDraft,
    });
    store.update(() => ({ name: 'Alice' }));
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('opts in without writing initial or unrelated state, then restores only selected fields', () => {
    const first = setup();
    first.store.update((state) => ({ ...state, pending: true }));
    expect(first.storage.setItem).not.toHaveBeenCalled();
    first.store.update((state) => ({ ...state, name: 'Alice' }));
    expect(JSON.parse(first.storage.getItem('draft:A')!)).toMatchObject({
      version: 1,
      savedAt: expect.any(Number),
      data: { name: 'Alice' },
    });
    first.store.update((state) => ({ ...state, pending: false }));
    expect(first.storage.setItem).toHaveBeenCalledTimes(1);
    const second = setup(first.storage);
    expect(second.store.getSnapshot()).toEqual({
      name: 'Alice',
      pending: false,
    });
    expect(first.storage.setItem).toHaveBeenCalledTimes(1);
  });

  it('ignores unselected cached fields even if validation allows them', () => {
    const storage = createStorage();
    storage.setItem(
      'draft:A',
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        data: {
          name: 'Alice',
          pending: true,
          extra: 'ignored',
        },
      }),
    );
    expect(setup(storage).store.getSnapshot()).toEqual({
      name: 'Alice',
      pending: false,
    });
  });

  it('keeps separate channel keys independent instead of rewriting a shared map', () => {
    const storage = createStorage();
    const first = setup(storage, 'draft:A');
    const second = setup(storage, 'draft:B');
    first.store.update((state) => ({ ...state, name: 'Alice' }));
    second.store.update((state) => ({ ...state, name: 'Bob' }));
    expect(setup(storage, 'draft:A').store.getSnapshot().name).toBe('Alice');
    expect(setup(storage, 'draft:B').store.getSnapshot().name).toBe('Bob');
  });

  it.each([
    'not json',
    'null',
    '[]',
    JSON.stringify({ version: 2, savedAt: Date.now(), data: { name: 'old' } }),
    JSON.stringify({ version: 1, data: { name: 'missing time' } }),
    JSON.stringify({
      version: 1,
      savedAt: 'yesterday',
      data: { name: 'bad time' },
    }),
    JSON.stringify({ version: 1, savedAt: Date.now(), data: { name: 123 } }),
  ])('discards invalid or incompatible cache: %s', (raw) => {
    const storage = createStorage();
    storage.setItem('draft:A', raw);
    storage.setItem('unrelated', 'keep');
    const { store } = setup(storage);
    expect(store.getSnapshot()).toEqual({ name: '', pending: false });
    expect(storage.getItem('draft:A')).toBeNull();
    expect(storage.getItem('unrelated')).toBe('keep');
  });

  it('expires from the last persisted change and does not extend TTL on read or UI changes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const storage = createStorage();
    const open = () => {
      const store = createStore({ name: '', pending: false });
      persistStore(store, {
        key: 'draft',
        version: 1,
        pick: ['name'],
        storage: () => storage,
        validate: isDraft,
        maxAgeMs: 100,
      });
      return store;
    };
    const first = open();
    first.update((state) => ({ ...state, name: 'Alice' }));
    vi.setSystemTime(1099);
    expect(open().getSnapshot().name).toBe('Alice');
    first.update((state) => ({ ...state, pending: true }));
    vi.setSystemTime(1100);
    expect(open().getSnapshot().name).toBe('');
    expect(storage.getItem('draft')).toBeNull();
    // TTL controls restoration, not live state or a background timer.
    expect(first.getSnapshot().name).toBe('Alice');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops synchronization without deleting cache or disabling store updates', () => {
    const { store, persistence, storage } = setup();
    store.update((state) => ({ ...state, name: 'Alice' }));
    persistence.dispose();
    persistence.dispose();
    store.update((state) => ({ ...state, name: 'Bob' }));
    expect(store.getSnapshot().name).toBe('Bob');
    expect(setup(storage).store.getSnapshot().name).toBe('Alice');
  });

  it('clears only its cache, keeps memory, and saves again only after selected fields change', () => {
    const { store, persistence, storage } = setup();
    store.update((state) => ({ ...state, name: 'Alice' }));
    persistence.clear();
    expect(store.getSnapshot().name).toBe('Alice');
    expect(storage.getItem('draft:A')).toBeNull();
    store.update((state) => ({ ...state, pending: true }));
    expect(storage.getItem('draft:A')).toBeNull();
    store.update((state) => ({ ...state, name: 'Bob' }));
    expect(setup(storage).store.getSnapshot().name).toBe('Bob');
    persistence.dispose();
    persistence.clear();
    expect(storage.getItem('draft:A')).toBeNull();
  });

  it('falls back to memory when accessing storage throws and isolates a throwing error reporter', () => {
    const store = createStore({ name: '' });
    const onError = vi.fn(() => {
      throw new Error('reporter failed');
    });
    const persistence = persistStore(store, {
      key: 'draft',
      version: 1,
      pick: ['name'],
      validate: isDraft,
      storage: () => {
        throw new Error('storage denied');
      },
      onError,
    });
    expect(() => store.update(() => ({ name: 'Alice' }))).not.toThrow();
    expect(() => persistence.clear()).not.toThrow();
    expect(store.getSnapshot()).toEqual({ name: 'Alice' });
    expect(onError).toHaveBeenCalled();
  });

  it('reports read, quota and remove errors without breaking updates', () => {
    const storage = createStorage();
    storage.getItem.mockImplementationOnce(() => {
      throw new Error('read denied');
    });
    const { store, onError, persistence } = setup(storage);
    expect(onError).toHaveBeenCalledTimes(1);
    storage.setItem.mockImplementationOnce(() => {
      throw new Error('quota exceeded');
    });
    expect(() =>
      store.update((state) => ({ ...state, name: 'Alice' })),
    ).not.toThrow();
    expect(onError).toHaveBeenCalledTimes(2);
    // A failed write can be retried by a later update.
    store.update((state) => ({ ...state, pending: true }));
    expect(setup(storage).store.getSnapshot().name).toBe('Alice');
    storage.removeItem.mockImplementationOnce(() => {
      throw new Error('remove denied');
    });
    expect(() => persistence.clear()).not.toThrow();
    expect(onError).toHaveBeenCalledTimes(3);
  });

  it('discards cache when the business validator throws', () => {
    const storage = createStorage();
    storage.setItem(
      'draft',
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        data: { name: 'Alice' },
      }),
    );
    const store = createStore({ name: '' });
    const onError = vi.fn();
    persistStore(store, {
      key: 'draft',
      version: 1,
      pick: ['name'],
      storage: () => storage,
      validate: (_value): _value is { name: string } => {
        throw new Error('invalid');
      },
      onError,
    });
    expect(store.getSnapshot()).toEqual({ name: '' });
    expect(storage.getItem('draft')).toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('allows a missing storage adapter and catches serialization errors', () => {
    const store = createStore<{ data: unknown }>({ data: null });
    const onError = vi.fn();
    const storage = createStorage();
    const persistence = persistStore(store, {
      key: 'draft',
      version: 1,
      pick: ['data'],
      storage: () => storage,
      validate: (value): value is { data: unknown } => Boolean(value),
      onError,
    });
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(() => store.update(() => ({ data: circular }))).not.toThrow();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(storage.setItem).not.toHaveBeenCalled();
    persistence.dispose();
    const memory = createStore({ name: '' });
    const handle = persistStore(memory, {
      key: 'draft',
      version: 1,
      pick: ['name'],
      storage: () => undefined,
      validate: isDraft,
    });
    memory.update(() => ({ name: 'Alice' }));
    expect(() => handle.clear()).not.toThrow();
    expect(memory.getSnapshot().name).toBe('Alice');
  });
});
