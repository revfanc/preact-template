import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const mode = process.env.BUILD_MODE ?? 'test';
if (mode !== 'test' && mode !== 'prod')
  throw new Error('BUILD_MODE must be test or prod');

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  // Keep a single active WebKit window on Windows to avoid delayed frame callbacks.
  workers: process.platform === 'win32' ? 1 : 2,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173/landing/',
    viewport: { width: 375, height: 812 },
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        channel:
          process.env.PLAYWRIGHT_CHANNEL ||
          (process.env.CI ? undefined : 'chrome'),
      },
    },
    {
      name: 'webkit',
      timeout: 60000,
      testMatch: /(?:scaffold|agreement|landing-ssg|request)\.spec\.ts/,
      use: { browserName: 'webkit' },
    },
  ],
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
      cwd: fileURLToPath(new URL('./apps/agreement', import.meta.url)),
      url: 'http://127.0.0.1:4174/agreement/privacy-policy/',
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
