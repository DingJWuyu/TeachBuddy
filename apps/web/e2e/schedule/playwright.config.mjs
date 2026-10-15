import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '..', testMatch: 'schedule/*.spec.js', workers: 2, retries: 0,
  timeout: 60000, expect: { timeout: 10000 },
  outputDir: '../../../../test-results/schedule', reporter: [['list']],
  use: {
    ignoreHTTPSErrors: true,
    viewport: { width: 1675, height: 950 },
    trace: 'retain-on-failure', screenshot: 'only-on-failure',
  },
});
