export interface ReadableStore<State> {
  getSnapshot: () => Readonly<State>;
  subscribe: (listener: () => void) => () => void;
}

/** Each call owns an independent snapshot. Replace nested values instead of mutating them. */
export function createStore<State extends object>(initial: State) {
  let state: Readonly<State> = Object.freeze({ ...initial });
  const listeners = new Set<() => void>();
  let disposed = false;
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      if (disposed) return () => {};
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update(reduce: (current: Readonly<State>) => State) {
      if (disposed) return;
      const next = reduce(state);
      if (next === state) return;
      state = Object.freeze({ ...next });
      Array.from(listeners).forEach((listener) => listener());
    },
    dispose() {
      disposed = true;
      listeners.clear();
    },
  };
}
