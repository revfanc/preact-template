import { fileURLToPath } from 'node:url';
import preact from '@preact/preset-vite';
import { defineConfig, loadEnv } from 'vite';
import { cssTargets } from '../../tooling/compatibility.ts';
import { pages } from '../../tooling/pages/index.ts';
import { createPostcssPlugins } from '../../tooling/postcss.ts';

const root = import.meta.dirname;
const theme = fileURLToPath(new URL('./src/theme.css', import.meta.url));

export default defineConfig(({ mode, command, isPreview }) => {
  if (mode !== 'test' && mode !== 'prod')
    throw new Error('mode must be test or prod');
  const env = loadEnv(mode, root, 'VITE_');
  if (env.VITE_APP_ENV !== mode)
    throw new Error('VITE_APP_ENV 必须与构建 mode 一致');
  return {
    root,
    base: env.VITE_BASE_PATH || '/agreement/',
    appType: command === 'serve' && !isPreview ? 'spa' : 'mpa',
    server: { host: '127.0.0.1', port: 5174, strictPort: true },
    preview: { host: '127.0.0.1', port: 4174, strictPort: true },
    css: { postcss: { plugins: createPostcssPlugins(false, theme) } },
    build: { cssTarget: cssTargets },
    plugins: [
      pages({ pattern: '**/index.tsx', eager: true, staticOnly: true }),
      preact({ prerender: { enabled: true, renderTarget: '#app' } }),
    ],
  };
});
