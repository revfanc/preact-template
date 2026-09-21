import { useLayoutEffect, useState } from 'preact/hooks';
import { useAppStores } from '@/stores/app/hooks';
import { useStore } from '@/stores/core/hooks';

export function useChannelStore() {
  const { channel } = useAppStores();
  const state = useStore(channel);
  const [mounted, setMounted] = useState(false);
  useLayoutEffect(() => setMounted(true), []);
  // A lazy page may hydrate after URL sync. Its first render must still match the static HTML.
  return {
    state: mounted ? state : channel.getInitialSnapshot(),
    store: channel,
  };
}
