import { defineConfig } from 'astro/config';
import { build, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import { createPostcssPlugins } from '../../tooling/postcss.ts';
import { cssTargets } from '../../tooling/compatibility.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const mode = process.env.AGREEMENT_MODE ?? 'test';
if (mode !== 'test' && mode !== 'prod')
  throw new Error('AGREEMENT_MODE must be test or prod');
const env = loadEnv(mode, root, 'VITE_');
if (env.VITE_APP_ENV !== mode)
  throw new Error('VITE_APP_ENV 必须与构建 mode 一致');
const base =
  `/${(env.VITE_BASE_PATH || '/agreement/').replace(/^\/+|\/+$/g, '')}/`.replace(
    '//',
    '/',
  );

export default defineConfig({
  output: 'static',
  base,
  trailingSlash: 'always',
  outDir: `./dist/${mode}`,
  scopedStyleStrategy: 'attribute',
  devToolbar: { enabled: false },
  server: ({ command }) => ({
    host: '127.0.0.1',
    port: command === 'dev' ? 5174 : 4174,
  }),
  integrations: [
    {
      name: 'agreement-script',
      hooks: {
        'astro:config:setup': async ({ command }) => {
          if (command === 'dev')
            await build({ configFile: `${root}/vite.config.ts`, mode });
        },
        'astro:build:done': async ({ dir }) => {
          await build({
            configFile: `${root}/vite.config.ts`,
            mode,
            build: { outDir: fileURLToPath(new URL('runtime/', dir)) },
          });
        },
        'astro:server:setup': async ({ server, logger }) => {
          const watcher = await build({
            configFile: `${root}/vite.config.ts`,
            mode,
            build: { watch: {} },
          });
          if (!('on' in watcher))
            throw new Error('Expected Vite build watcher');
          watcher.on('event', (event) => {
            if (event.code === 'END') server.ws.send({ type: 'full-reload' });
            if (event.code === 'ERROR') logger.error(String(event.error));
          });
          server.httpServer?.once('close', () => {
            void watcher.close();
          });
        },
      },
    },
  ],
  vite: {
    css: { postcss: { plugins: createPostcssPlugins() } },
    build: { cssTarget: cssTargets },
    server: { strictPort: true },
  },
});
