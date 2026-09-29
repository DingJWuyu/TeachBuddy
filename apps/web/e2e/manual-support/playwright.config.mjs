import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: '.', testMatch: '*.spec.js', workers: 1, timeout: 60000,
  expect: { timeout: 8000 }, reporter: 'list', outputDir: '../../../../test-results/manual-support',
  use: { ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' } });
