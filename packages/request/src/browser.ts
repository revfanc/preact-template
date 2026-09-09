import AbortControllerPolyfill from 'abort-controller';
import { fetch as fetchPolyfill } from 'whatwg-fetch';
import { createRequestClient, type RequestClientOptions } from './index';

export function createBrowserRequestClient(
  options: Omit<RequestClientOptions, 'fetch' | 'createAbortController'> = {},
) {
  const nativeAbort = typeof window.AbortController === 'function';
  const nativeAbortableFetch =
    nativeAbort && 'signal' in new Request(window.location.href);
  return createRequestClient({
    ...options,
    fetch: nativeAbortableFetch ? window.fetch.bind(window) : fetchPolyfill,
    createAbortController: createBrowserAbortController,
  });
}

export function createBrowserAbortController(): AbortController {
  // 旧实现没有 reason/throwIfAborted；请求层只使用 abort、aborted 和事件。
  return typeof window.AbortController === 'function'
    ? new window.AbortController()
    : (new AbortControllerPolyfill() as unknown as AbortController);
}
