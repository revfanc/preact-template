import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import preact from '@preact/preset-vite';
import { build, defineConfig, loadEnv } from 'vite';
import type { BuildOptions } from 'vite';
import { cssTargets, scriptTargets } from '../../tooling/compatibility.ts';
import { createPostcssPlugins } from '../../tooling/postcss.ts';
import type { prerender } from './src/prerender.tsx';

const root = import.meta.dirname;
const theme = fileURLToPath(new URL('./src/theme.css', import.meta.url));

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
  const css = () => ({
    postcss: { plugins: createPostcssPlugins(false, theme) },
  });
  const buildRuntime = (options: BuildOptions) =>
    build({
      configFile: false,
      root,
      base,
      mode,
      publicDir: false,
      css: css(),
      build: {
        target: scriptTargets,
        cssTarget: cssTargets,
        minify: 'terser',
        terserOptions: { safari10: true },
        lib: {
          entry: 'src/main.ts',
          name: 'Agreement',
          formats: ['iife'],
          fileName: () => 'agreement.js',
          cssFileName: 'agreement',
        },
        ...options,
      },
    });
  return {
    root,
    base,
    appType: 'mpa',
    server: { host: '127.0.0.1', port: 5174, strictPort: true },
    preview: { host: '127.0.0.1', port: 4174, strictPort: true },
    css: css(),
    build: {
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
          const watcher = await buildRuntime({
            outDir: 'public/runtime',
            watch: {},
          });
          if (!('on' in watcher))
            throw new Error('Expected Vite build watcher');
          server.httpServer?.once('close', () => {
            void watcher.close();
          });
          // Wait for the watcher's first build instead of building twice at startup.
          await new Promise<void>((resolve, reject) => {
            watcher.on('event', (event) => {
              if (event.code === 'END') {
                server.ws.send({ type: 'full-reload' });
                resolve();
              }
              if (event.code === 'ERROR') {
                server.config.logger.error(String(event.error));
                reject(event.error);
              }
            });
          }).catch(async (error: unknown) => {
            await watcher.close();
            throw error;
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
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.end(
                  html
                    .replace(
                      '</head>',
                      () => `${[...result.head.elements].join('')}</head>`,
                    )
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
          await buildRuntime({ outDir: 'dist/runtime' });
        },
      },
    ],
  };
});
