import { useStore, useStoreInstance } from '@/stores/core/hooks';
import { createRouteStore } from './index';

/** Each owner gets a separate route store; consumers subscribe to the passed instance. */
export function useLocalRouteStore() {
  const store = useStoreInstance(createRouteStore);
  const state = useStore(store);
  return { state, store };
}
