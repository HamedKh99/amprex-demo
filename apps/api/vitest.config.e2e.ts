import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

// Runs against E2E_DATABASE_URL, which global-setup RESETS and reseeds. Never point it at real data.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['test/global-setup.ts'],
    env: { DATABASE_URL: process.env.E2E_DATABASE_URL ?? '' },
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
