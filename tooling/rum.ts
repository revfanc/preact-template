import type { Plugin } from 'vite';

/** Inject the official ARMS RUM SDK only when an application endpoint is configured. */
export function rum(options: {
  app: string;
  endpoint?: string;
  version?: string;
  env: 'prod' | 'daily';
  spa?: boolean;
}): Plugin {
  return {
    name: 'arms-rum',
    transformIndexHtml() {
      if (!options.endpoint) return [];
      const config = JSON.stringify({
        endpoint: options.endpoint,
        env: options.env,
        version: options.version,
        spaMode: options.spa ? 'history' : 'false',
        properties: { app: options.app },
      }).replace(/</g, '\\u003c');
      return [
        {
          tag: 'script',
          injectTo: 'body-prepend',
          children: `window.__rum=${config};`,
        },
        {
          tag: 'script',
          injectTo: 'body-prepend',
          attrs: {
            src: 'https://sdk.rum.aliyuncs.com/v2/browser-sdk.js',
            async: true,
            crossorigin: 'anonymous',
          },
        },
      ];
    },
  };
}
