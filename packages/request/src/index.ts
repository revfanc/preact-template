export type RequestErrorKind =
  'http' | 'network' | 'timeout' | 'abort' | 'parse';

export class RequestError extends Error {
  constructor(
    message: string,
    public readonly kind: RequestErrorKind,
    public readonly status?: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'RequestError';
  }
}

export interface RequestClientOptions {
  baseURL?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  credentials?: 'same-origin' | 'include';
  fetch?: typeof fetch;
  createAbortController?: () => AbortController;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
  query?: Record<string, string | number | boolean | null | undefined>;
  json?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  responseType?: 'json' | 'text';
}

export function createRequestClient(options: RequestClientOptions = {}) {
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  const createController =
    options.createAbortController ?? (() => new AbortController());

  return {
    async request<T = unknown>(
      path: string,
      init: RequestOptions = {},
    ): Promise<T | undefined> {
      const controller = createController();
      const timeoutMs = init.timeoutMs ?? options.timeoutMs ?? 10000;
      if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
        throw new RangeError('timeoutMs 必须是大于等于 0 的有限数值');
      }
      if (init.signal?.aborted) throw new RequestError('请求已取消', 'abort');
      const onAbort = () => controller.abort();
      let timedOut = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      init.signal?.addEventListener('abort', onAbort);
      try {
        if (timeoutMs > 0) {
          timer = setTimeout(() => {
            timedOut = true;
            controller.abort();
          }, timeoutMs);
        }
        const headers = new Headers(options.headers);
        for (const key of Object.keys(init.headers ?? {}))
          headers.set(key, init.headers![key]!);
        if (init.json !== undefined && !headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json');
        }
        const response = await fetcher(
          buildURL(options.baseURL ?? '', path, init.query),
          {
            method: init.method ?? 'GET',
            headers,
            body:
              init.json === undefined ? undefined : JSON.stringify(init.json),
            credentials: options.credentials ?? 'same-origin',
            signal: controller.signal,
          },
        );
        if (!response.ok)
          throw new RequestError(
            `HTTP ${response.status}`,
            'http',
            response.status,
          );
        if (
          response.status === 204 ||
          response.status === 205 ||
          init.method === 'HEAD'
        )
          return undefined;
        const text = await response.text();
        if (init.responseType === 'text') return text as T;
        if (text === '') return undefined;
        try {
          return JSON.parse(text) as T;
        } catch (cause) {
          throw new RequestError(
            '响应不是有效的 JSON',
            'parse',
            response.status,
            cause,
          );
        }
      } catch (cause) {
        if (timedOut)
          throw new RequestError('请求超时', 'timeout', undefined, cause);
        if (controller.signal.aborted)
          throw new RequestError('请求已取消', 'abort', undefined, cause);
        if (cause instanceof RequestError) throw cause;
        throw new RequestError('网络请求失败', 'network', undefined, cause);
      } finally {
        if (timer !== undefined) clearTimeout(timer);
        init.signal?.removeEventListener('abort', onAbort);
      }
    },
  };
}

function buildURL(
  baseURL: string,
  path: string,
  query: RequestOptions['query'],
) {
  let url = `${baseURL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`.split(
    '#',
  )[0]!;
  const pairs: string[] = [];
  for (const key of Object.keys(query ?? {})) {
    const value = query![key];
    if (value !== undefined && value !== null)
      pairs.push(
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
      );
  }
  if (pairs.length > 0)
    url += `${url.includes('?') ? '&' : '?'}${pairs.join('&')}`;
  return url;
}

export type RequestClient = ReturnType<typeof createRequestClient>;
