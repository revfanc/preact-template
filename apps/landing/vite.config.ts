import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import preact from '@preact/preset-vite';
import legacy from '@vitejs/plugin-legacy';
import { defineConfig, loadEnv } from 'vite';
import { cssTargets, legacyTargets } from '../../tooling/compatibility.ts';
import { createPostcssPlugins } from '../../tooling/postcss.ts';
import { createFileRoutes } from './src/router/file-routes.ts';
import { landingHtml } from './build/html.ts';

const root = import.meta.dirname;
const theme = fileURLToPath(new URL('./src/theme.css', import.meta.url));

export default defineConfig(({ mode }) => {
  if (mode !== 'test' && mode !== 'prod')
    throw new Error('请使用 --mode test 或 --mode prod');
  const env = loadEnv(mode, root, 'VITE_');
  if (env.VITE_APP_ENV !== mode)
    throw new Error('VITE_APP_ENV 必须与构建 mode 一致');
  return {
    root,
    base: env.VITE_BASE_PATH || '/',
    resolve: { dedupe: ['preact'] },
    // The preset sets the JSX runtime but omits its source in the Vite 8 scanner.
    optimizeDeps: {
      rolldownOptions: { transform: { jsx: { importSource: 'preact' } } },
    },
    css: { postcss: { plugins: createPostcssPlugins(true, theme) } },
    build: { outDir: `dist/${mode}`, minify: 'terser', cssTarget: cssTargets },
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    preview: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: true,
      proxy: { '/agreement/': 'http://127.0.0.1:4174' },
    },
    plugins: [
      legacy({ targets: legacyTargets }),
      preact({ reactAliasesEnabled: false }),
      landingHtml(theme),
      {
        name: 'agreement-dev-navigation',
        configureServer(server) {
          // Astro's dev modules use root URLs; keep its origin separate from Vite.
          server.middlewares.use((request, response, next) => {
            const url = new URL(
              request.url || '/',
              `http://${request.headers.host}`,
            );
            if (
              url.pathname !== '/agreement' &&
              !url.pathname.startsWith('/agreement/')
            )
              return next();
            url.port = '5174';
            response.writeHead(302, { Location: url.href });
            response.end();
          });
        },
      },
      {
        name: 'validate-file-routes',
        buildStart() {
          createFileRoutes(
            readdirSync(new URL('./src/pages/', import.meta.url), {
              recursive: true,
              encoding: 'utf8',
            }).map((file) => file.replace(/\\/g, '/')),
          );
        },
      },
    ],
  };
});
