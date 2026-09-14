import { createBrowserRequestClient } from '@packages/request/browser';

// Callable ofetch instance. Bind real @packages/api endpoints to it when added.
export const request = createBrowserRequestClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || import.meta.env.BASE_URL,
});
