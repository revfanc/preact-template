import { useCallback, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { loading, type Close } from '@packages/feedback';

export function useRouteLoading() {
  const [isLoading, setIsLoading] = useState(false);
  const closeLoading = useRef<Close>();
  const startLoading = useCallback(() => {
    closeLoading.current ??= loading({ mask: true });
    setIsLoading(true);
  }, []);
  const finishLoading = useCallback(() => {
    closeLoading.current?.();
    closeLoading.current = undefined;
    setIsLoading(false);
  }, []);
  useLayoutEffect(() => () => closeLoading.current?.(), []);
  return { isLoading, startLoading, finishLoading };
}
