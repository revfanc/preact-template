import { createStore } from '../core';

export function createRouteStore() {
  const state = createStore({ isLoading: false });
  const finish = () => {
    state.update((current) =>
      current.isLoading ? { isLoading: false } : current,
    );
  };
  return {
    getSnapshot: state.getSnapshot,
    subscribe: state.subscribe,
    start() {
      state.update((current) =>
        current.isLoading ? current : { isLoading: true },
      );
    },
    finish,
    dispose() {
      finish();
      state.dispose();
    },
  };
}
