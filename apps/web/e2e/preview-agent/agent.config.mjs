import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: '../c26', testMatch: '*.spec.js', workers: 1, timeout: 45000,
  outputDir: '../../../../test-results/preview-agent', use: { browserName: 'chromium', ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' } });
