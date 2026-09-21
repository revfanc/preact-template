import { createChannelStore } from '@/stores/channel';

/** Own application-wide domain stores here, not one combined state snapshot. */
export function createAppStores() {
  const channel = createChannelStore();
  return Object.freeze({
    channel,
    dispose() {
      channel.dispose();
    },
  });
}

export type AppStores = ReturnType<typeof createAppStores>;
