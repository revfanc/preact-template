import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import { scriptTargets, cssTargets } from '../../tooling/compatibility.ts';
import { createPostcssPlugins } from '../../tooling/postcss.ts';

const theme = fileURLToPath(new URL('./src/theme.css', import.meta.url));

// Only progressive enhancement is bundled here; TSX pages run in Node.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, 'VITE_');
  return {
    root: import.meta.dirname,
    base: env.VITE_BASE_PATH || '/agreement/',
    publicDir: false,
    css: { postcss: { plugins: createPostcssPlugins(false, theme) } },
    build: {
      outDir: 'public/runtime',
      emptyOutDir: true,
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
    },
  };
});
