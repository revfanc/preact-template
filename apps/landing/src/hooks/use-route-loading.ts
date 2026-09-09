import { useCallback, useState } from 'preact/hooks';

export function useRouteLoading() {
  const [isLoading, setIsLoading] = useState(false);
  const startLoading = useCallback(() => setIsLoading(true), []);
  const finishLoading = useCallback(() => setIsLoading(false), []);
  return { isLoading, startLoading, finishLoading };
}
