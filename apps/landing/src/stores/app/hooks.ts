import { useContext } from 'preact/hooks';
import { AppStoresContext } from './context';

/** Reads the shared registry; domain hooks subscribe to individual stores. */
export function useAppStores() {
  const stores = useContext(AppStoresContext);
  if (!stores) {
    throw new Error('useAppStores must be used within AppStoresProvider.');
  }
  return stores;
}
