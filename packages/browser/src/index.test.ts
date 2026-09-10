// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Done } from './types';

let register: typeof import('./index').register;
let entries: Array<{ state: unknown; url: string }>;
let position: number;
let queue: number[];
let nativeReplace: History['replaceState'];
const errors = vi.fn();
const options = { onError: errors };
const tick = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
function land(index: number) {
  position = index;
  const entry = entries[index]!;
  nativeReplace(entry.state, '', entry.url);
  window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
}
async function complete() {
  const index = queue.shift();
  if (index === undefined) throw new Error('No pending traversal');
  land(index);
  await tick();
}
async function drain() {
  for (let i = 0; queue.length && i < 10; i++) await complete();
  expect(queue).toEqual([]);
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  errors.mockClear();
  nativeReplace = history.replaceState.bind(history);
  nativeReplace({ router: { key: 1 } }, '', '/a');
  entries = [{ state: history.state, url: location.href }];
  position = 0;
  queue = [];
  vi.spyOn(history, 'replaceState').mockImplementation((state, title, url) => {
    nativeReplace(state, title, url);
    entries[position] = { state: history.state, url: location.href };
  });
  vi.spyOn(history, 'pushState').mockImplementation((state, title, url) => {
    nativeReplace(state, title, url);
    entries.splice(position + 1);
    entries.push({ state: history.state, url: location.href });
    position++;
  });
  vi.spyOn(history, 'go').mockImplementation((delta = 0) => {
    const target = position + delta;
    if (target >= 0 && target < entries.length) queue.push(target);
  });
  ({ register } = await import('./index'));
});
afterEach(() => {
  window.dispatchEvent(new Event('pagehide'));
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('shares one guard across registrations and removes exact stack entries', async () => {
  const a = vi.fn(),
    b = vi.fn(),
    c = vi.fn();
  const offA = register(a, options);
  const offB = register(b, options);
  const offC = register(c, options);
  expect(entries).toHaveLength(2);
  expect(history.state.router).toEqual({ key: 1 });
  await offB();
  land(0);
  expect(c).toHaveBeenCalledOnce();
  expect(a).not.toHaveBeenCalled();
  expect(b).not.toHaveBeenCalled();
  await complete();
  await offC();
  land(0);
  expect(a).toHaveBeenCalledOnce();
  await complete();
  const cleanup = offA();
  expect(offA()).toBe(cleanup);
  await complete();
  await cleanup;
  expect(position).toBe(0);
  expect(errors).not.toHaveBeenCalled();
});

it('done consumes the top after restoration and leaves the lower handler for the next Back', async () => {
  const lower = vi.fn();
  register(lower, options);
  let done!: Done;
  let result!: Promise<void>;
  const off = register((value) => {
    done = value;
    result = done();
    expect(done()).toBe(result);
    return result;
  }, options);
  land(0);
  const resolved = vi.fn();
  void result.then(resolved);
  expect(queue).toEqual([1]);
  expect(resolved).not.toHaveBeenCalled();
  await complete();
  await result;
  expect(resolved).toHaveBeenCalledOnce();
  expect(position).toBe(1);
  expect(lower).not.toHaveBeenCalled();
  expect(queue).toEqual([]);
  expect(off()).toBe(result);
  land(0);
  expect(lower).toHaveBeenCalledOnce();
  await complete();
});

it('completes three layers in LIFO order and releases only the last layer', async () => {
  const calls: number[] = [];
  const handles = [1, 2, 3].map((id) =>
    register((done) => {
      calls.push(id);
      return done();
    }, options),
  );
  for (const id of [3, 2, 1]) {
    land(0);
    await complete();
    if (id === 1) {
      expect(queue).toEqual([0]);
      await complete();
    }
    expect(queue).toEqual([]);
    expect(position).toBe(id === 1 ? 0 : 1);
    await handles[id - 1]!();
  }
  expect(calls).toEqual([3, 2, 1]);
  expect(history.go).toHaveBeenCalledTimes(4);
  expect(errors).not.toHaveBeenCalled();
});

it('a new registration revokes pending done before restoration without consuming the old layer', async () => {
  let decision!: Promise<unknown>;
  const original = vi.fn((done: Done) => {
    decision = done().catch((error: unknown) => error);
    return decision.then(() => {});
  });
  register(original, options);
  land(0);
  const off = register(() => {}, options);
  await complete();
  expect(await decision).toMatchObject({ name: 'AbortError' });
  expect(position).toBe(1);
  await off();
  land(0);
  await drain();
  expect(original).toHaveBeenCalledTimes(2);
  expect(position).toBe(0);
});

it('last done and unregister share release timeout and block registration until cleanup ends', async () => {
  let decision!: Promise<void>;
  const off = register((done) => {
    decision = done();
    return decision;
  }, options);
  land(0);
  await complete();
  expect(off()).toBe(decision);
  expect(() => register(() => {}, options)).toThrow(
    'Wait for the last unregister',
  );
  const outcome = decision.catch((error: unknown) => error);
  await vi.advanceTimersByTimeAsync(2000);
  expect(await outcome).toMatchObject({ name: 'TimeoutError' });
  expect(errors).toHaveBeenCalledOnce();
  expect(queue).toEqual([0]);
});

it('rejects a done captured by a finished callback', async () => {
  let done!: Done;
  register((value) => {
    done = value;
  }, options);
  land(0);
  await complete();
  await expect(done()).rejects.toMatchObject({ name: 'AbortError' });
  expect(position).toBe(1);
  expect(queue).toEqual([]);
});

it('last unregister during restoration waits, then releases only once', async () => {
  const off = register(() => new Promise<void>(() => {}), options);
  land(0);
  const result = off();
  expect(off()).toBe(result);
  expect(queue).toEqual([1]);
  await complete();
  expect(queue).toEqual([0]);
  await complete();
  await result;
  expect(position).toBe(0);
  expect(queue).toEqual([]);
});

it('adopts the guard after a document restart without growing history', async () => {
  register(() => {}, options);
  const state = history.state;
  window.dispatchEvent(new Event('pagehide'));
  vi.resetModules();
  const fresh = await import('./index');
  const off = fresh.register(() => {}, options);
  expect(history.state).toEqual(state);
  expect(entries).toHaveLength(2);
  const pending = off();
  await drain();
  await pending;
});

it('ends ignored traversals with an error instead of assuming completion', async () => {
  const off = register(() => {}, options);
  const cleanup = off();
  const result = cleanup.catch((error: unknown) => error);
  await vi.advanceTimersByTimeAsync(2000);
  expect(await result).toMatchObject({ name: 'TimeoutError' });
  expect(errors).toHaveBeenCalledOnce();
});

it('treats identical callback registrations independently', async () => {
  const handler = vi.fn();
  const offA = register(handler, options);
  const offB = register(handler, options);
  await offA();
  land(0);
  expect(handler).toHaveBeenCalledOnce();
  await complete();
  const cleanup = offB();
  await drain();
  await cleanup;
  expect(position).toBe(0);
});

it('holds an async decision while repeated Back attempts only restore the same guard', async () => {
  let done!: Done;
  let finish!: () => void;
  const handler = vi.fn((value: Done) => {
    done = value;
    return new Promise<void>((resolve) => {
      finish = resolve;
    });
  });
  register(handler, options);
  land(0);
  await complete();
  land(0);
  expect(queue).toEqual([1]);
  const result = done();
  await complete();
  await complete();
  await result;
  finish();
  await tick();
  expect(handler).toHaveBeenCalledOnce();
  expect(position).toBe(0);
});

it('expires the old decision when a new top is registered during restoration', async () => {
  let done!: Done;
  register((value) => {
    done = value;
    return new Promise<void>(() => {});
  }, options);
  land(0);
  const next = vi.fn();
  register(next, options);
  expect(entries).toHaveLength(2);
  await expect(done()).rejects.toMatchObject({ name: 'AbortError' });
  await complete();
  expect(next).not.toHaveBeenCalled();
  land(0);
  expect(next).toHaveBeenCalledOnce();
  await complete();
});

it('removing an active top invalidates its done without invoking the lower layer', async () => {
  const lower = vi.fn();
  register(lower, options);
  let done!: Done;
  const off = register((value) => {
    done = value;
    return new Promise<void>(() => {});
  }, options);
  land(0);
  const permission = done();
  const outcome = permission.catch((error: unknown) => error);
  await off();
  expect(await outcome).toMatchObject({ name: 'AbortError' });
  await complete();
  expect(queue).toEqual([]);
  expect(lower).not.toHaveBeenCalled();
  land(0);
  expect(lower).toHaveBeenCalledOnce();
  await complete();
});

it('last unregister during release shares the outstanding go(-1)', async () => {
  let decision!: Promise<void>;
  const off = register((done) => {
    decision = done();
    return decision;
  }, options);
  land(0);
  await complete();
  expect(queue).toEqual([0]);
  const outcome = decision.catch((error: unknown) => error);
  const cleanup = off();
  expect(cleanup).toBe(decision);
  expect(queue).toEqual([0]);
  await complete();
  await cleanup;
  expect(await outcome).toBeUndefined();
  expect(queue).toEqual([]);
});

it('done removes the final registration so Forward and Back cannot revive it', async () => {
  const handler = vi.fn((done: Done) => done());
  const off = register(handler, options);
  land(0);
  await drain();
  expect(position).toBe(0);
  land(1);
  expect(handler).toHaveBeenCalledOnce();
  land(0);
  await drain();
  expect(handler).toHaveBeenCalledOnce();
  await off();
  expect(queue).toEqual([]);
});

it('re-registering at base truncates forward entries and preserves business state', async () => {
  const off = register((done) => done(), options);
  land(0);
  await drain();
  await off();
  history.pushState({ route: 'b' }, '', '/b');
  history.pushState({ route: 'c' }, '', '/c');
  land(0);
  register(() => {}, options);
  expect(entries).toHaveLength(2);
  expect(history.state.router).toEqual({ key: 1 });
  expect(location.pathname).toBe('/a');
});

it('does not pull another page back when a captured done or unregister runs', async () => {
  let done!: Done;
  const off = register((value) => {
    done = value;
    return new Promise<void>(() => {});
  }, options);
  land(0);
  await complete();
  history.pushState({ route: 'b' }, '', '/b');
  await expect(done()).rejects.toMatchObject({ name: 'AbortError' });
  await off();
  expect(queue).toEqual([]);
  expect(location.pathname).toBe('/b');
});

it('unexpected history destinations abort restoration without another traversal', async () => {
  history.pushState({}, '', '/b');
  let outcome!: Promise<unknown>;
  register((done) => {
    outcome = done().catch((error: unknown) => error);
  }, options);
  land(1);
  land(0);
  expect(await outcome).toMatchObject({ name: 'AbortError' });
  expect(queue).toHaveLength(1); // The already-issued native traversal cannot be cancelled.
  await complete();
  expect(queue).toEqual([]);
});

it('rejects unsupported state and conflicting markers before changing history', () => {
  for (const state of [
    [],
    'text',
    1,
    new Date(),
    { __packages_browser__: { version: 2 } },
  ]) {
    history.replaceState(state, '', '/a');
    expect(() => register(() => {}, options)).toThrow();
    expect(history.state).toEqual(state);
    expect(entries).toHaveLength(1);
  }
});

it('accepts null state and rolls back the base marker if initial push fails', () => {
  history.replaceState(null, '', '/a');
  vi.mocked(history.pushState).mockImplementationOnce(() => {
    throw new Error('blocked');
  });
  expect(() => register(() => {}, options)).toThrow('blocked');
  expect(history.state).toBeNull();
  register(() => {}, options);
  expect(entries).toHaveLength(2);
});

it('reports callback errors and revokes an unfulfilled done without releasing', async () => {
  const error = new Error('callback failed');
  let result!: Promise<unknown>;
  register((done) => {
    result = done().catch((reason: unknown) => reason);
    throw error;
  }, options);
  land(0);
  await complete();
  expect(queue).toEqual([]);
  expect(await result).toMatchObject({ name: 'AbortError' });
  expect(errors).toHaveBeenCalledWith(error);
});

it('reports a synchronous go error and makes stale done reject', async () => {
  const error = new Error('go failed');
  register(() => {}, options);
  vi.mocked(history.go).mockImplementationOnce(() => {
    throw error;
  });
  land(0);
  await tick();
  expect(errors).toHaveBeenCalledOnce();
  expect(errors).toHaveBeenCalledWith(error);
});

it('a non-top unregister does not revoke the active top decision', async () => {
  const off = register(() => {}, options);
  let done!: Done;
  register((value) => {
    done = value;
    return new Promise<void>(() => {});
  }, options);
  land(0);
  await complete();
  await off();
  const decision = done();
  await tick();
  await complete();
  await decision;
  expect(position).toBe(0);
  expect(errors).not.toHaveBeenCalled();
});

it('late business failures after done do not restore a released page', async () => {
  const error = new Error('after release');
  register(async (done) => {
    await done();
    throw error;
  }, options);
  land(0);
  await drain();
  await tick();
  expect(position).toBe(0);
  expect(queue).toEqual([]);
  expect(errors).toHaveBeenCalledWith(error);
});

it('last cleanup must finish before a fresh registration is accepted', async () => {
  const off = register(() => {}, options);
  const cleanup = off();
  expect(() => register(() => {}, options)).toThrow(
    'Wait for the last unregister',
  );
  await complete();
  await cleanup;
  register(() => {}, options);
  expect(entries).toHaveLength(2);
  expect(position).toBe(1);
});

it('user Forward confirming restoration never invokes a callback or sends another go(1)', async () => {
  const handler = vi.fn();
  register(handler, options);
  land(0);
  // A user traversal lands on the expected target before another observed notification.
  land(1);
  await tick();
  await complete();
  expect(handler).toHaveBeenCalledOnce();
  expect(history.go).toHaveBeenCalledTimes(1);
  expect(queue).toEqual([]);
});

it('reports leaving the pair during a decision even before done was called', async () => {
  history.pushState({}, '', '/b');
  register(() => new Promise<void>(() => {}), options);
  land(1);
  await complete();
  land(0);
  expect(errors).toHaveBeenCalledOnce();
  expect(errors.mock.calls[0]![0]).toMatchObject({ name: 'AbortError' });
  expect(queue).toEqual([]);
});
