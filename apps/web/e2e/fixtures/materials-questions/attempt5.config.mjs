import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '../..', testMatch: 'materials-questions-local5.spec.js', workers: 1,
  timeout: 30000, expect: { timeout: 3000 }, reporter: [['list']],
  outputDir: '../../../../../test-results/r33-attempt5/e2e',
  use: { browserName: 'chromium', ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } },
});
