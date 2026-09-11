import { useLayoutEffect, useState } from 'preact/hooks';
import { useSyncExternalStore } from 'preact/compat';
import type { ReadableStore } from './core';
import { createRouteStore } from './route';

/** Subscribers share an owner's instance; they do not destroy it. */
export function useStore<State>(store: ReadableStore<State>) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

/** Create once at the scope owner; pass the instance through props or Context. */
export function useStoreInstance<Store extends { dispose: () => void }>(
  create: () => Store,
): Store {
  const [store] = useState(create);
  useLayoutEffect(() => () => store.dispose(), [store]);
  return store;
}

/** Each owner gets a separate route store; consumers subscribe to the passed instance. */
export function useRouteStore() {
  const store = useStoreInstance(createRouteStore);
  const state = useStore(store);
  return { state, store };
}
