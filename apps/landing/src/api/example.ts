import type { FetchOptions } from '@packages/request';
import { request } from '@/request';

export interface ExampleParams {
  id: string;
}

export interface ExampleDetail {
  id: string;
  title: string;
}

/** 示例契约，不对应真实后端；接入业务时替换地址、参数及响应校验。 */
export async function getExample(
  params: ExampleParams,
  options: Pick<FetchOptions, 'signal' | 'timeout'> = {},
): Promise<ExampleDetail> {
  const response = await request<unknown>('/__example__/detail', {
    ...options,
    method: 'GET',
    query: params,
  });

  if (
    !response ||
    typeof response !== 'object' ||
    !('code' in response) ||
    typeof response.code !== 'number'
  )
    throw new Error('示例接口响应格式不正确');
  if (response.code !== 200)
    throw new Error(`示例接口业务失败，code=${response.code}`);

  const data = 'data' in response ? response.data : undefined;
  if (
    !data ||
    typeof data !== 'object' ||
    !('id' in data) ||
    typeof data.id !== 'string' ||
    !('title' in data) ||
    typeof data.title !== 'string'
  )
    throw new Error('示例接口响应格式不正确');
  return { id: data.id, title: data.title };
}
