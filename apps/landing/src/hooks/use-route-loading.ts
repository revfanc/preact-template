import { createRouteStore } from '../stores/route';
import { useStore, useStoreInstance } from './use-store';

export function useRouteLoading() {
  const store = useStoreInstance(createRouteStore);
  const { isLoading } = useStore(store);
  return { isLoading, startLoading: store.start, finishLoading: store.finish };
}
