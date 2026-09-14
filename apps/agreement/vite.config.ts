import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import preact from '@preact/preset-vite';
import { build, defineConfig, loadEnv } from 'vite';
import type { EnvironmentModuleNode } from 'vite';
import { cssTargets } from '../../tooling/compatibility.ts';
import { createPostcssPlugins } from '../../tooling/postcss.ts';
import type { prerender } from './src/prerender.tsx';

const root = fileURLToPath(new URL('.', import.meta.url));
const theme = fileURLToPath(new URL('./src/theme.css', import.meta.url));
const runtimeConfig = fileURLToPath(
  new URL('./vite.runtime.config.ts', import.meta.url),
);

export default defineConfig(({ mode, command }) => {
  if (mode !== 'test' && mode !== 'prod')
    throw new Error('mode must be test or prod');
  const env = loadEnv(mode, root, 'VITE_');
  if (env.VITE_APP_ENV !== mode)
    throw new Error('VITE_APP_ENV 必须与构建 mode 一致');
  const base =
    `/${(env.VITE_BASE_PATH || '/agreement/').replace(/^\/+|\/+$/g, '')}/`.replace(
      '//',
      '/',
    );
  return {
    root,
    base,
    appType: 'mpa',
    server: { host: '127.0.0.1', port: 5174, strictPort: true },
    preview: { host: '127.0.0.1', port: 4174, strictPort: true },
    css: { postcss: { plugins: createPostcssPlugins(false, theme) } },
    build: {
      outDir: `dist/${mode}`,
      cssTarget: cssTargets,
      cssCodeSplit: false,
    },
    plugins: [
      preact({
        prefreshEnabled: false,
        devToolsEnabled: false,
        prerender: {
          enabled: true,
          prerenderScript: fileURLToPath(
            new URL('./src/prerender.tsx', import.meta.url),
          ),
        },
      }),
      {
        name: 'agreement-static',
        enforce: 'post',
        transformIndexHtml: {
          order: 'post',
          handler() {
            return [
              {
                tag: 'script',
                attrs: {
                  id: 'agreement-runtime',
                  src: `${base}runtime/agreement.js`,
                  defer: true,
                },
                injectTo: 'body',
              },
            ];
          },
        },
        async configureServer(server) {
          await build({ configFile: runtimeConfig, mode });
          const watcher = await build({
            configFile: runtimeConfig,
            mode,
            build: { watch: {} },
          });
          if (!('on' in watcher))
            throw new Error('Expected Vite build watcher');
          watcher.on('event', (event) => {
            if (event.code === 'END') server.ws.send({ type: 'full-reload' });
            if (event.code === 'ERROR')
              server.config.logger.error(String(event.error));
          });
          server.httpServer?.once('close', () => {
            void watcher.close();
          });
          server.watcher.on('change', (file) => {
            if (/\.(tsx?|css)$/.test(file))
              server.ws.send({ type: 'full-reload' });
          });
          return () => {
            server.middlewares.use(async (req, res, next) => {
              try {
                const path = new URL(
                  req.url || '/',
                  'http://localhost',
                ).pathname
                  .replace(/index\.html$/, '')
                  .replace(/\/?$/, '/');
                const module = (await server.ssrLoadModule(
                  '/src/prerender.tsx',
                )) as { prerender: typeof prerender };
                if (!module.prerender({ url: '/' }).links.has(path))
                  return next();
                const result = module.prerender({ url: path });
                const template = await readFile(
                  new URL('./index.html', import.meta.url),
                  'utf8',
                );
                const html = await server.transformIndexHtml(
                  req.url || '/',
                  template,
                );
                // SSR evaluates CSS imports without attaching them to the document.
                // Link the same styles explicitly so development matches static output.
                const styles = new Set<string>();
                const visited = new Set<EnvironmentModuleNode>();
                function collectStyles(node: EnvironmentModuleNode) {
                  if (visited.has(node)) return;
                  visited.add(node);
                  if (node.url.endsWith('.css')) styles.add(node.url);
                  for (const dependency of node.importedModules)
                    collectStyles(dependency);
                }
                const entry =
                  await server.environments.ssr?.moduleGraph.getModuleByUrl(
                    '/src/prerender.tsx',
                  );
                if (entry) collectStyles(entry);
                const styleLinks = [...styles]
                  .map(
                    (url) =>
                      `<link rel="stylesheet" href="${base}${url.slice(1).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">`,
                  )
                  .join('');
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.end(
                  html
                    .replace('</head>', () => `${styleLinks}</head>`)
                    .replace('<body>', () => `<body>${result.html}`)
                    .replace(
                      /<title>.*?<\/title>/,
                      () =>
                        `<title>${result.head.title.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</title>`,
                    ),
                );
              } catch (error) {
                next(error);
              }
            });
          };
        },
        // All document chunks are build-only. Only the classic entry runs in browsers.
        generateBundle: {
          order: 'post',
          handler(_, bundle) {
            for (const [file, output] of Object.entries(bundle)) {
              if (output.type === 'chunk') delete bundle[file];
            }
          },
        },
        async closeBundle() {
          if (command !== 'build') return;
          await build({
            configFile: runtimeConfig,
            mode,
            build: { outDir: `dist/${mode}/runtime` },
          });
        },
      },
    ],
  };
});
