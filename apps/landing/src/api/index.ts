import { createBrowserRequestClient } from '@packages/request/browser';

// Bind real @packages/api endpoints to this application transport when added.
export const request = createBrowserRequestClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || import.meta.env.BASE_URL,
});
