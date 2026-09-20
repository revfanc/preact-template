import { createRequestClient } from '@packages/request';
import { createBrowserRequestClient } from '@packages/request/browser';

// Prerender imports page dependencies in Node; constructing a client does not send requests.
const createClient =
  typeof window === 'undefined'
    ? createRequestClient
    : createBrowserRequestClient;

export const request = createClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || import.meta.env.BASE_URL,
});
