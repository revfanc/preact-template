import { useLayoutEffect, useMemo } from 'preact/hooks';
import { loading, type Close } from '@packages/feedback';
import { useStore, useStoreInstance } from '../stores';
import { createRouteStore } from '../stores/route';

export function useRouteLoading() {
  const store = useStoreInstance(createRouteStore);
  const { isLoading } = useStore(store);
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
    isLoading,
    startLoading: feedback.startLoading,
    finishLoading: feedback.finishLoading,
  };
}
