import { useStore, useStoreInstance } from '@/stores/core/hooks';
import { createLoadingStore } from './index';

/** Each owner gets a separate loading store; consumers subscribe to the passed instance. */
export function useLocalLoadingStore() {
  const store = useStoreInstance(createLoadingStore);
  const state = useStore(store);
  return { state, store };
}
