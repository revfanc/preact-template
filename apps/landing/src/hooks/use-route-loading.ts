import { useLayoutEffect, useMemo } from 'preact/hooks';
import { loading, type Close } from '@packages/feedback';
import { useLocalRouteStore } from '@/stores';

export function useRouteLoading() {
  const { state, store } = useLocalRouteStore();
  const feedback = useMemo(() => {
    let close: Close | undefined;
    let disposed = false;
    const finishLoading = () => {
      close?.();
      close = undefined;
      store.finish();
    };
    return {
      startLoading() {
        if (disposed || store.getSnapshot().isLoading) return;
        close = loading({ mask: true });
        store.start();
      },
      finishLoading,
      dispose() {
        disposed = true;
        finishLoading();
      },
    };
  }, [store]);
  useLayoutEffect(() => () => feedback.dispose(), [feedback]);
  return {
    isLoading: state.isLoading,
    startLoading: feedback.startLoading,
    finishLoading: feedback.finishLoading,
  };
}
