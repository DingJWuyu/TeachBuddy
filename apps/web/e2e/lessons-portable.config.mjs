import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.', testMatch: 'lessons-portable.spec.js', workers: 1, timeout: 180000,
  expect: { timeout: 10000 }, reporter: 'list', outputDir: '../../../test-results/lessons-portable/browser',
  use: { launchOptions: { executablePath: '/opt/google/chrome/chrome' }, ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' },
});
