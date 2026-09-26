import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: ['classes-journal.spec.js', 'classes-capabilities.spec.js'], workers: 1, retries: 0,
  timeout: 60000, expect: { timeout: 8000 }, reporter: [['list']],
  outputDir: process.env.CLASSES_TEST_OUTPUT || '../../../test-results/classes-journal',
  use: { launchOptions: { executablePath: '/opt/google/chrome/chrome' },
    ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' }
});
