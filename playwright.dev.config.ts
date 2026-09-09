import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  testDir: './tests/browser-dev',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    viewport: { width: 375, height: 812 },
  },
  webServer: [
    {
      command: 'pnpm dev',
      cwd: fileURLToPath(new URL('./apps/agreement', import.meta.url)),
      env: { ASTRO_DEV_BACKGROUND: '1' },
      url: 'http://127.0.0.1:5174/agreement/',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm dev',
      cwd: fileURLToPath(new URL('./apps/landing', import.meta.url)),
      url: 'http://127.0.0.1:5173/',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
