// 包的默认 browser 入口只转发原生对象；这里必须导入真正的兼容实现。
import AbortControllerPolyfill from 'abort-controller/dist/abort-controller.js';
import {
  fetch as fetchPolyfill,
  Headers as HeadersPolyfill,
} from './whatwg-fetch.js';
import { createRequestClient, type FetchOptions } from './index';

export function createBrowserRequestClient(options: FetchOptions = {}) {
  const nativeAbort = typeof window.AbortController === 'function';
  const nativeAbortableFetch =
    nativeAbort &&
    typeof window.fetch === 'function' &&
    typeof window.Request === 'function' &&
    'signal' in new window.Request(window.location.href);
  return createRequestClient(options, {
    fetch: nativeAbortableFetch ? window.fetch.bind(window) : fetchPolyfill,
    // Match the Headers implementation to the transport, including iteration on old devices.
    Headers: nativeAbortableFetch ? window.Headers : HeadersPolyfill,
    AbortController: getAbortController(),
  });
}

export function createBrowserAbortController(): AbortController {
  return new (getAbortController())();
}

function getAbortController(): typeof AbortController {
  // 旧实现没有 reason/throwIfAborted；请求层只使用 abort、aborted 和事件。
  return typeof window.AbortController === 'function'
    ? window.AbortController
    : (AbortControllerPolyfill as unknown as typeof AbortController);
}
