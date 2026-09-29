import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'manual-teaching.spec.js', workers: 1, retries: 0,
  timeout: 60000, expect: { timeout: 8000 },
  outputDir: '../../../test-results/manual-teaching/browser', reporter: [['list']],
  use: { ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' }
});
