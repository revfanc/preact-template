import { fileURLToPath } from 'node:url';
import preact from '@preact/preset-vite';
import legacy from '@vitejs/plugin-legacy';
import { defineConfig } from 'vite';
import { cssTargets, legacyTargets } from '../../../tooling/compatibility.ts';
import { createPostcssPlugins } from '../../../tooling/postcss.ts';
import { landingHtml } from '../build/html.ts';

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
    landingHtml(theme),
  ],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    minify: 'terser',
    cssTarget: cssTargets,
  },
  preview: {
    host: '127.0.0.1',
    port: 4176,
    strictPort: true,
    proxy: { '/agreement/': 'http://127.0.0.1:4174' },
  },
}));
