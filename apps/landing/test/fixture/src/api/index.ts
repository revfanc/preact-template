import { createApi } from './fixture-api';
import { createRequestClient } from '@packages/request';

export const api = createApi(
  createRequestClient({
    baseURL: import.meta.env.VITE_API_BASE_URL || import.meta.env.BASE_URL,
  }),
  { configPath: import.meta.env.VITE_CONFIG_PATH },
);
