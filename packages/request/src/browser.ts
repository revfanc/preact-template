// 包的默认 browser 入口只转发原生对象；这里必须导入真正的兼容实现。
import AbortControllerPolyfill from 'abort-controller/dist/abort-controller.js';
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
