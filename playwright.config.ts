import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const mode = process.env.BUILD_MODE ?? 'test';
if (mode !== 'test' && mode !== 'prod')
  throw new Error('BUILD_MODE must be test or prod');

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  workers: 2,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173/landing/',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    viewport: { width: 375, height: 812 },
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command:
        'node node_modules/vite/bin/vite.js preview --config apps/landing/test/vite.config.ts --mode test',
      url: 'http://127.0.0.1:4176/landing/',
      reuseExistingServer: false,
    },
    {
      command: `node node_modules/vite/bin/vite.js preview --config packages/browser/test/vite.config.ts --mode ${mode}`,
      url: 'http://127.0.0.1:4175/',
      reuseExistingServer: false,
    },
    {
      command: `pnpm preview:${mode}`,
      // Astro 7 otherwise detaches when launched by an AI agent; Playwright owns this process.
      env: { ASTRO_PREVIEW_BACKGROUND: '1' },
      cwd: fileURLToPath(new URL('./apps/agreement', import.meta.url)),
      url: 'http://127.0.0.1:4174/agreement/',
      reuseExistingServer: false,
    },
    {
      command: `node ../../node_modules/vite/bin/vite.js preview --mode ${mode}`,
      cwd: fileURLToPath(new URL('./apps/landing', import.meta.url)),
      url: 'http://127.0.0.1:4173/landing/',
      reuseExistingServer: false,
    },
  ],
});
