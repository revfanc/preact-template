import preact from '@preact/preset-vite';
import { defineConfig, mergeConfig } from 'vite';
import { createWebConfig } from '../../tooling/vite.ts';
import { readdirSync } from 'node:fs';
import { createFileRoutes } from './src/router/file-routes.ts';

export default defineConfig(({ mode }) =>
  mergeConfig(createWebConfig(mode, 5173, true), {
    resolve: { dedupe: ['preact'] },
    // The preset sets the JSX runtime but omits its source in the Vite 8 scanner.
    optimizeDeps: {
      rolldownOptions: { transform: { jsx: { importSource: 'preact' } } },
    },
    plugins: [
      preact({ reactAliasesEnabled: false }),
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
    server: { proxy: { '/agreement/': 'http://127.0.0.1:5174' } },
    preview: { proxy: { '/agreement/': 'http://127.0.0.1:4174' } },
  }),
);
