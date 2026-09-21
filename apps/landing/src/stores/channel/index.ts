import { createStore } from '@/stores/core';

export interface ChannelContext {
  channelCode: string;
  undertakePageConfigId?: string;
  clickid?: string;
  linkId?: string;
}

export const channelQueryKeys = [
  'channelCode',
  'undertakePageConfigId',
  'clickid',
  'linkId',
] as const;

/** Only URL context: no configuration request, default channel or storage fallback. */
export function readChannelContext(
  search: string,
): Readonly<ChannelContext> | null {
  const params = new URLSearchParams(search);
  const context: Partial<ChannelContext> = {};
  for (const key of channelQueryKeys) {
    const values = params.getAll(key);
    if (values.length > 1) throw new Error(`渠道参数 ${key} 不能重复`);
    const value = values[0]?.trim();
    if (value) context[key] = value;
  }
  return context.channelCode
    ? Object.freeze({ ...context, channelCode: context.channelCode })
    : null;
}

interface ChannelState {
  initialized: boolean;
  context: Readonly<ChannelContext> | null;
  error: string | null;
}

export function createChannelStore() {
  const state = createStore<ChannelState>({
    initialized: false,
    context: null,
    error: null,
  });
  const initial = state.getSnapshot();
  return {
    getInitialSnapshot: () => initial,
    getSnapshot: state.getSnapshot,
    subscribe: state.subscribe,
    sync(search: string) {
      let context: Readonly<ChannelContext> | null = null;
      let error: string | null = null;
      try {
        context = readChannelContext(search);
      } catch (cause) {
        error = cause instanceof Error ? cause.message : String(cause);
      }
      state.update((current) =>
        current.initialized &&
        current.error === error &&
        channelQueryKeys.every(
          (key) => current.context?.[key] === context?.[key],
        )
          ? current
          : { initialized: true, context, error },
      );
    },
    dispose: state.dispose,
  };
}
