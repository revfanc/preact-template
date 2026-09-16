import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: [
      'tests/**/*.test.ts',
      'tooling/**/*.test.ts',
      'packages/**/*.test.{ts,tsx}',
      'apps/**/*.test.{ts,tsx}',
    ],
    environment: 'node',
  },
});
