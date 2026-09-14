import { ofetch, type CreateFetchOptions, type FetchOptions } from 'ofetch';

export { FetchError } from 'ofetch';
export type * from 'ofetch';

/** Create an ofetch instance with shared defaults; business policies belong in packages/api. */
export function createRequestClient(
  defaults: FetchOptions = {},
  transport: Omit<CreateFetchOptions, 'defaults'> = {},
) {
  return ofetch.create(
    { retry: 0, timeout: 10000, credentials: 'same-origin', ...defaults },
    transport,
  );
}
