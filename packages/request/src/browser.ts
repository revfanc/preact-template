// whatwg-fetch 的默认 browser 入口只转发原生对象，必须导入真正的兼容实现。
import AbortControllerPolyfill from 'abort-controller/dist/abort-controller.js';
import {
  fetch as fetchPolyfill,
  Headers as HeadersPolyfill,
} from './whatwg-fetch.js';
import type { CreateFetchOptions } from 'ofetch';

export function assertBrowser() {
  if (typeof window === 'undefined')
    throw new Error(
      '业务请求不能在 Node 预渲染阶段执行，请从客户端 effect 或事件触发',
    );
}

export function getBrowserTransport(): CreateFetchOptions {
  assertBrowser();
  const nativeAbort = typeof window.AbortController === 'function';
  const nativeAbortableFetch =
    nativeAbort &&
    typeof window.fetch === 'function' &&
    typeof window.Request === 'function' &&
    'signal' in new window.Request(window.location.href);
  return {
    fetch: nativeAbortableFetch ? window.fetch.bind(window) : fetchPolyfill,
    // Match the Headers implementation to the transport, including iteration on old devices.
    Headers: nativeAbortableFetch ? window.Headers : HeadersPolyfill,
    AbortController: getAbortController(),
  };
}

export function createAbortController(): AbortController {
  return new (getAbortController())();
}

function getAbortController(): typeof AbortController {
  // 旧实现没有 reason/throwIfAborted；请求层只使用 abort、aborted 和事件。
  return typeof window !== 'undefined' &&
    typeof window.AbortController === 'function'
    ? window.AbortController
    : (AbortControllerPolyfill as unknown as typeof AbortController);
}
