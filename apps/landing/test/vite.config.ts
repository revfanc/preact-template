import { fileURLToPath } from 'node:url';
import preact from '@preact/preset-vite';
import legacy from '@vitejs/plugin-legacy';
import { defineConfig } from 'vite';
import { cssTargets, legacyTargets } from '../../../tooling/compatibility.ts';
import { createPostcssPlugins } from '../../../tooling/postcss.ts';
import { landingHtml } from '../build/html.ts';
import { fileRoutes } from '../../../tooling/file-routes/index.ts';

const theme = fileURLToPath(new URL('../src/theme.css', import.meta.url));
export default defineConfig(({ mode }) => ({
  root: fileURLToPath(new URL('./fixture', import.meta.url)),
  base: '/landing/',
  define: {
    'import.meta.env.VITE_APP_ENV': JSON.stringify(mode),
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(''),
    'import.meta.env.VITE_CONFIG_PATH': JSON.stringify('site-config.json'),
    'import.meta.env.VITE_AGREEMENT_URL': JSON.stringify('/agreement/'),
  },
  resolve: { tsconfigPaths: true, dedupe: ['preact'] },
  css: { postcss: { plugins: createPostcssPlugins(true, theme) } },
  plugins: [
    legacy({ targets: legacyTargets }),
    preact({ reactAliasesEnabled: false }),
    fileRoutes({
      include: '**/index.tsx',
      exclude: '**/_*/**',
      notFound: '_404/index.tsx',
    }),
    landingHtml(theme),
  ],
  build: {
    rolldownOptions: {
      input: {
        app: fileURLToPath(new URL('./fixture/index.html', import.meta.url)),
        request: fileURLToPath(
          new URL('./fixture/request.html', import.meta.url),
        ),
        persist: fileURLToPath(
          new URL('./fixture/persist.html', import.meta.url),
        ),
        asyncModal: fileURLToPath(
          new URL('./fixture/async-modal.html', import.meta.url),
        ),
      },
    },
    outDir: '../dist',
    emptyOutDir: true,
    cssTarget: cssTargets,
  },
  preview: {
    host: '127.0.0.1',
    port: 4176,
    strictPort: true,
    proxy: { '/agreement/': 'http://127.0.0.1:4174' },
  },
}));
