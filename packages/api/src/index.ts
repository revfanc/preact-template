import type { RequestClient } from '@packages/request';

export interface SiteConfig {
  title: string;
  description: string;
  companyName: string;
}

export interface ApiOptions {
  configPath: string;
}

export function createApi(client: RequestClient, options: ApiOptions) {
  return {
    async getConfig(signal?: AbortSignal): Promise<SiteConfig> {
      const data = await client.request(options.configPath, { signal });
      if (!isSiteConfig(data)) throw new Error('站点配置格式不正确');
      return data;
    },
  };
}

function isSiteConfig(value: unknown): value is SiteConfig {
  if (!value || typeof value !== 'object') return false;
  return (
    'title' in value &&
    typeof value.title === 'string' &&
    'description' in value &&
    typeof value.description === 'string' &&
    'companyName' in value &&
    typeof value.companyName === 'string'
  );
}
