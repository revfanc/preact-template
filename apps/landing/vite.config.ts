import { fileURLToPath } from 'node:url';
import preact from '@preact/preset-vite';
import { defineConfig, mergeConfig, type ViteDevServer } from 'vite';
import { createWebConfig } from '../../tooling/vite.ts';
import { readFileSync, readdirSync } from 'node:fs';
import { createFileRoutes } from './src/router/file-routes.ts';
import { loadingHtml } from '../../packages/feedback/src/notice/markup.ts';
import postcss from 'postcss';
import { createPostcssPlugins } from '../../tooling/postcss.ts';

const theme = fileURLToPath(new URL('./src/theme.css', import.meta.url));

export default defineConfig(({ mode }) =>
  mergeConfig(createWebConfig(mode, 5173, true, theme), {
    resolve: { dedupe: ['preact'] },
    // The preset sets the JSX runtime but omits its source in the Vite 8 scanner.
    optimizeDeps: {
      rolldownOptions: { transform: { jsx: { importSource: 'preact' } } },
    },
    plugins: [
      {
        name: 'initial-page-loading',
        transformIndexHtml: {
          order: 'pre',
          async handler(html: string) {
            // HTML styles bypass Vite's CSS pipeline, so compile the same theme here.
            const compile = async (source: string) =>
              (
                await postcss(createPostcssPlugins(true, theme)).process(
                  source,
                  {
                    from: undefined,
                  },
                )
              ).css;
            return {
              html: html.replace('<!-- page-loading -->', loadingHtml),
              tags: [
                {
                  tag: 'style',
                  attrs: { id: 'page-loading-style' },
                  children: await compile(
                    'html { background: var(--background); }\n' +
                      readFileSync(
                        new URL(
                          '../../packages/feedback/src/notice/style.css',
                          import.meta.url,
                        ),
                        'utf8',
                      ),
                  ),
                  injectTo: 'head',
                },
              ],
            };
          },
        },
      },
      preact({ reactAliasesEnabled: false }),
      {
        name: 'agreement-dev-navigation',
        configureServer(server: ViteDevServer) {
          // Astro's dev modules use root URLs; give it its own origin to avoid CSS/HMR collisions.
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
    preview: { proxy: { '/agreement/': 'http://127.0.0.1:4174' } },
  }),
);
