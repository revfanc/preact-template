import type { ReadableStore } from './index';

export interface PersistOptions<State extends object, Key extends keyof State> {
  /** Fixed for this instance; include the channel/user/order scope in the key. */
  key: string;
  version: number;
  pick: readonly Key[];
  /** A getter also lets us catch browser access errors. No browser globals at import time. */
  storage: () =>
    Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined;
  validate: (data: unknown) => data is Pick<State, Key>;
  /** Restoration TTL measured from the last successful write. Omit for no expiry. */
  maxAgeMs?: number;
  onError?: (error: unknown) => void;
}

/** Restores synchronously. Attach once in a client effect for prerendered owners, before edits or requests. */
export function persistStore<State extends object, Key extends keyof State>(
  store: ReadableStore<State> & {
    update: (reduce: (current: Readonly<State>) => State) => void;
  },
  options: PersistOptions<State, Key>,
) {
  const {
    key,
    version,
    storage,
    validate,
    maxAgeMs,
    onError = console.error,
  } = options;
  const fields = [...options.pick];
  if (!key.trim() || !Number.isInteger(version) || version < 0)
    throw new TypeError(
      'Persistence requires a non-empty key and a non-negative integer version',
    );
  if (maxAgeMs !== undefined && (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0))
    throw new RangeError('maxAgeMs must be a positive finite number');

  function report(error: unknown) {
    try {
      onError(error);
    } catch {
      /* Reporting must not break in-memory updates. */
    }
  }

  function select(state: Pick<State, Key>): Pick<State, Key> {
    const selected = Object.create(null) as Pick<State, Key>;
    for (const field of fields) selected[field] = state[field];
    return selected;
  }

  function remove() {
    try {
      storage()?.removeItem(key);
    } catch (error) {
      report(error);
    }
  }

  function restore(): Pick<State, Key> | undefined {
    let raw: string | null | undefined;
    try {
      raw = storage()?.getItem(key);
    } catch (error) {
      report(error);
      return;
    }
    if (raw === null || raw === undefined) return;
    try {
      const cache: unknown = JSON.parse(raw);
      if (
        isRecord(cache) &&
        cache.version === version &&
        typeof cache.savedAt === 'number' &&
        Number.isFinite(cache.savedAt) &&
        cache.savedAt >= 0 &&
        (maxAgeMs === undefined ||
          (Date.now() >= cache.savedAt &&
            Date.now() - cache.savedAt < maxAgeMs)) &&
        isRecord(cache.data) &&
        validate(cache.data)
      )
        return select(cache.data);
    } catch (error) {
      report(error);
    }
    remove();
  }

  function serialize() {
    try {
      return JSON.stringify(select(store.getSnapshot()));
    } catch (error) {
      report(error);
      return undefined;
    }
  }

  const restored = restore();
  if (restored) store.update((current) => ({ ...current, ...restored }));
  let previous = serialize();
  let disposed = false;
  const unsubscribe = store.subscribe(() => {
    if (disposed) return;
    const serialized = serialize();
    if (serialized === undefined || serialized === previous) return;
    try {
      const target = storage();
      if (!target) return;
      // Reuse the serialized selection instead of invoking toJSON a second time.
      target.setItem(
        key,
        `{"version":${version},"savedAt":${Date.now()},"data":${serialized}}`,
      );
      previous = serialized;
    } catch (error) {
      report(error);
    }
  });

  return {
    /** Remove disk data only; subsequent selected-field changes can persist again. */
    clear() {
      remove();
      previous = serialize();
    },
    /** Stop persistence without deleting cache or disposing the store. */
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
