import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'remove-lessons.spec.js', workers: 1, timeout: 90000,
  expect: { timeout: 15000 }, reporter: [['list']],
  outputDir: '../../../test-results/remove-lessons/web/browser',
  use: { ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' },
});
