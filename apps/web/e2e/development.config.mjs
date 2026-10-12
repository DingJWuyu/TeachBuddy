import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.', testMatch: 'development.spec.js', workers: 1,
  timeout: 60000, expect: { timeout: 15000 }, reporter: 'list',
  outputDir: '../../../test-results/development',
  use: { ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
