import 'core-js/modules/es.promise.js';
// whatwg-fetch inspects this API while reading request and response bodies.
import 'core-js/modules/web.url-search-params.js';
import { createApi } from '@packages/api';
import { createBrowserRequestClient } from '@packages/request/browser';
import { loading } from '@packages/ui';

const api = createApi(
  createBrowserRequestClient({
    baseURL: import.meta.env.VITE_API_BASE_URL || import.meta.env.BASE_URL,
  }),
  { configPath: import.meta.env.VITE_CONFIG_PATH },
);
const displayName = document.getElementById('display-name')!;
const companyName = document.getElementById('company-name')!;
const status = document.getElementById('config-status')!;
const retry = document.getElementById('retry-config') as HTMLButtonElement;

const nameMatch = /(?:\?|&)name=([^&]*)/.exec(window.location.search);
if (nameMatch?.[1]) {
  try {
    displayName.textContent =
      decodeURIComponent(nameMatch[1].replace(/\+/g, ' '))
        .trim()
        .slice(0, 40) || '未提供';
  } catch {
    displayName.textContent = '未提供';
  }
}

async function loadConfig() {
  const closeLoading = loading('正在加载服务提供方…');
  status.textContent = '';
  retry.hidden = true;
  try {
    const config = await api.getConfig();
    companyName.textContent = config.companyName;
    status.textContent = '';
  } catch {
    status.textContent = '服务提供方加载失败，正文仍可阅读。';
    retry.hidden = false;
  } finally {
    closeLoading();
  }
}

retry.addEventListener('click', () => void loadConfig());
void loadConfig();
