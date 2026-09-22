import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '../..', testMatch: 'math-static-real.spec.js', workers: 1,
  timeout: 60000, expect: { timeout: 10000 },
  outputDir: '../../../../../test-results/m41/real-playwright',
  use: { headless: true, ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } }
});
