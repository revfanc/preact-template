import { createApi } from './fixture-api';
import { createBrowserRequestClient } from '@packages/request/browser';

export const api = createApi(
  createBrowserRequestClient({
    baseURL: import.meta.env.VITE_API_BASE_URL || import.meta.env.BASE_URL,
  }),
  { configPath: import.meta.env.VITE_CONFIG_PATH },
);
