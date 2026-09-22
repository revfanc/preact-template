import {
  createFetch,
  createFetchError,
  type $Fetch,
  type CreateFetchOptions,
  type FetchOptions,
  type FetchContext,
  type FetchHook,
  type FetchRequest,
  type ResponseType,
} from 'ofetch';
import {
  assertBrowser,
  getBrowserTransport,
  createAbortController,
} from './browser';
import { createLifetime } from './lifetime';

export { FetchError } from 'ofetch';
export { createAbortController } from './browser';
export type * from 'ofetch';

async function runHooks<C extends FetchContext>(
  hooks: FetchHook<C> | FetchHook<C>[] | undefined,
  context: C,
) {
  if (!hooks) return;
  for (const hook of Array.isArray(hooks) ? hooks : [hooks])
    await hook(context);
}

/** Create an ofetch instance with shared defaults; business policies belong in packages/api. */
export function createRequestClient(
  defaults: FetchOptions = {},
  transport: Omit<CreateFetchOptions, 'defaults'> = {},
) {
  const settings: FetchOptions = {
    retry: 0,
    timeout: 10000,
    credentials: 'same-origin',
    ...defaults,
  };
  const request: $Fetch = async <T, R extends ResponseType = 'json'>(
    url: FetchRequest,
    options?: FetchOptions<R>,
  ) => {
    const response = await request.raw<T, R>(url, options);
    return response._data!;
  };
  request.raw = async <T, R extends ResponseType = 'json'>(
    url: FetchRequest,
    options?: FetchOptions<R>,
  ) => {
    assertBrowser();
    const runtime = { ...getBrowserTransport(), ...transport };
    const controller = runtime.AbortController
      ? new runtime.AbortController()
      : createAbortController();
    let context: FetchContext;
    const lifetime = createLifetime(controller, (error) =>
      createFetchError({ ...context, error }),
    );
    const hooks = options?.onRequest ?? settings.onRequest;
    const client = createFetch({
      ...runtime,
      defaults: settings,
      fetch: async (...args) => {
        lifetime.check();
        try {
          const response = await runtime.fetch!(...args);
          lifetime.check();
          return response;
        } catch (error) {
          // Stop ofetch retries after either kind of cancellation.
          if (controller.signal.aborted) {
            const abort = new Error('Request aborted');
            abort.name = 'AbortError';
            throw abort;
          }
          throw error;
        }
      },
    });
    try {
      return await Promise.race([
        client.raw<T, R>(url, {
          ...options,
          async onRequest(value) {
            lifetime.check();
            context = value;
            await runHooks(hooks, value);
            lifetime.start(
              value.options.signal ??
                (typeof value.request === 'string'
                  ? undefined
                  : value.request.signal),
              value.options.timeout,
            );
            // Own the signal/deadline across all attempts; do not start ofetch's timer.
            value.options.signal = lifetime.signal;
            value.options.timeout = 0;
            lifetime.check();
          },
          async onResponse(value) {
            lifetime.check();
            await runHooks(options?.onResponse ?? settings.onResponse, value);
            lifetime.check();
          },
        }),
        lifetime.cancelled,
      ]);
    } finally {
      lifetime.dispose();
    }
  };
  request.native = async (...args) => {
    assertBrowser();
    return (transport.fetch ?? getBrowserTransport().fetch!)(...args);
  };
  request.create = (next, overrides = {}) =>
    createRequestClient(
      { ...settings, ...overrides.defaults, ...next },
      { ...transport, ...overrides },
    );
  return request;
}
