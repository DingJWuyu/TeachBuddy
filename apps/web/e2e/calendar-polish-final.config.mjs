import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'calendar-polish-final.spec.js', workers: 1, retries: 0,
  timeout: 60000, expect: { timeout: 10000 },
  outputDir: '../../../test-results/calendar-polish-final', reporter: [['list']],
  use: { ignoreHTTPSErrors: true, timezoneId: 'Asia/Shanghai', viewport: { width: 1675, height: 950 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' }
});
