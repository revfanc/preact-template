import type { FetchOptions } from '@packages/request';
import { request, type ApiResponse } from '@/request';

export interface ExampleParams {
  id: string;
}

export interface ExampleDetail {
  id: string;
  title: string;
}

export type ExampleResponse = ApiResponse<ExampleDetail | null>;

/** 示例契约，不对应真实后端；接入业务时替换地址和输入输出类型。 */
export function getExample(
  params: ExampleParams,
  options: Pick<FetchOptions, 'signal' | 'timeout'> = {},
) {
  return request<ExampleResponse>('/__example__/detail', {
    ...options,
    method: 'GET',
    query: params,
  });
}
