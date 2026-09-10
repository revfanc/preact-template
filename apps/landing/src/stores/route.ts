import { loading, type Close } from '@packages/feedback';
import { createStore } from './create-store';

export function createRouteStore() {
  const state = createStore({ isLoading: false });
  let close: Close | undefined;
  let disposed = false;
  const finish = () => {
    close?.();
    close = undefined;
    if (state.getSnapshot().isLoading)
      state.update(() => ({ isLoading: false }));
  };
  return {
    getSnapshot: state.getSnapshot,
    subscribe: state.subscribe,
    start() {
      if (disposed || state.getSnapshot().isLoading) return;
      close = loading({ mask: true });
      state.update(() => ({ isLoading: true }));
    },
    finish,
    dispose() {
      if (disposed) return;
      disposed = true;
      finish();
      state.dispose();
    },
  };
}
