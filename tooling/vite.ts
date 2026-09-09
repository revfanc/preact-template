import legacy from '@vitejs/plugin-legacy';
import { loadEnv, type UserConfig } from 'vite';
import { cssTargets, legacyTargets } from './compatibility.ts';
import { createPostcssPlugins } from './postcss.ts';

export function createWebConfig(
  mode: string,
  port: number,
  rem = false,
): UserConfig {
  if (mode !== 'test' && mode !== 'prod') {
    throw new Error('请使用 --mode test 或 --mode prod');
  }
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [legacy({ targets: legacyTargets })],
    css: { postcss: { plugins: createPostcssPlugins(rem) } },
    build: { outDir: `dist/${mode}`, minify: 'terser', cssTarget: cssTargets },
    server: { host: '127.0.0.1', port, strictPort: true },
    preview: { host: '127.0.0.1', port: port - 1000, strictPort: true },
  };
}
