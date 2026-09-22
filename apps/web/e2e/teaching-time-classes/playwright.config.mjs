import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '..', testMatch: 'teaching-time-classes*.spec.js',
  outputDir: '../../../../test-results/t51-math-playwright',
  fullyParallel: false, workers: 1, timeout: 30000,
  reporter: [['list']],
  use: { browserName: 'chromium', headless: true, ignoreHTTPSErrors: true, trace: 'retain-on-failure' }
});
