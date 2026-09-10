import { useLayoutEffect, useState } from 'preact/hooks';
import type { SiteConfig } from '../api/fixture-api';
import { createBrowserAbortController } from '@packages/request/browser';
import { loading } from '@packages/feedback';
import { api } from '../api';

export function useSiteConfig() {
  const [config, setConfig] = useState<SiteConfig>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Register before Router's layout effect releases its handle, keeping one indicator.
  useLayoutEffect(() => {
    const controller = createBrowserAbortController();
    const closeLoading = loading();
    let active = true;
    setError(false);
    api.getConfig(controller.signal).then(
      (value) => {
        closeLoading();
        if (active) setConfig(value);
      },
      () => {
        closeLoading();
        if (active) setError(true);
      },
    );
    return () => {
      active = false;
      controller.abort();
      closeLoading();
    };
  }, [attempt]);

  return { config, error, reload: () => setAttempt((value) => value + 1) };
}
