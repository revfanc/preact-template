import { useLayoutEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { useAppStores } from '@/stores';

/** Mount once inside LocationProvider, outside the lazy page's lifetime. */
export function useChannel() {
  const { url } = useLocation();
  const { channel } = useAppStores();
  const search = new URL(url, 'https://landing.invalid').search;
  // No store writes during render: prerender and hydration start with the same empty snapshot.
  useLayoutEffect(() => channel.sync(search), [channel, search]);
}
