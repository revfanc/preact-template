import preact from '@preact/preset-vite';
import { defineConfig, mergeConfig } from 'vite';
import { createWebConfig } from '../../tooling/vite.ts';

export default defineConfig(({ mode }) =>
  mergeConfig(createWebConfig(mode, 5173, true), {
    plugins: [preact({ reactAliasesEnabled: false })],
    server: { proxy: { '/agreement/': 'http://127.0.0.1:5174' } },
    preview: { proxy: { '/agreement/': 'http://127.0.0.1:4174' } },
  }),
);
