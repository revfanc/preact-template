import { createRequestClient } from '@packages/request';

export interface ApiResponse<T = unknown> {
  code: number;
  message?: string;
  data?: T;
}

export class BusinessError extends Error {
  readonly code: number;
  readonly data: unknown;

  constructor(response: ApiResponse) {
    super(response.message ?? `业务请求失败，code=${response.code}`);
    this.name = 'BusinessError';
    this.code = response.code;
    this.data = response.data;
  }
}

export class ResponseFormatError extends Error {
  constructor() {
    super('接口响应格式不正确');
    this.name = 'ResponseFormatError';
  }
}

export const request = createRequestClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || import.meta.env.BASE_URL,
  onResponse({ response }) {
    // Preserve the transport's HTTP error instead of replacing it with a protocol error.
    if (!response.ok) return;
    const body: unknown = response._data;
    if (!isApiResponse(body)) throw new ResponseFormatError();
    if (body.code !== 200) throw new BusinessError(body);
  },
});

function isApiResponse(value: unknown): value is ApiResponse {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'code' in value &&
    typeof value.code === 'number' &&
    Number.isFinite(value.code) &&
    (!('message' in value) || typeof value.message === 'string')
  );
}
