import { createRequestClient } from '@packages/request';
export const request = createRequestClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || import.meta.env.BASE_URL,
});
