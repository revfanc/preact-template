import { useCallback, useEffect, useRef } from 'preact/hooks';
import { loading, type Close } from '@packages/ui';

export function useRouteLoading() {
  const closeLoading = useRef<Close>();
  const finishLoading = useCallback(() => {
    closeLoading.current?.();
    closeLoading.current = undefined;
  }, []);
  const startLoading = useCallback(() => {
    closeLoading.current ??= loading('正在加载页面…');
  }, []);

  useEffect(() => finishLoading, [finishLoading]);
  return { startLoading, finishLoading };
}
