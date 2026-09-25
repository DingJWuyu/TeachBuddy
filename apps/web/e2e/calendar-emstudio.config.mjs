import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'calendar-emstudio.spec.js', workers: 1, retries: 0,
  timeout: 60000, expect: { timeout: 10000 },
  outputDir: '../../../test-results/calendar-emstudio', reporter: [['list']],
  use: { launchOptions: { executablePath: '/opt/google/chrome/chrome' },
    ignoreHTTPSErrors: true, viewport: { width: 1675, height: 858 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' }
});
