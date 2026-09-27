import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.', testMatch: ['lessons-page.spec.js', 'lessons-page-real.spec.js'], workers: 1,
  timeout: 120000, expect: { timeout: 10000 }, reporter: 'list',
  outputDir: '../../../test-results/lessons-page/browser',
  use: { launchOptions: { executablePath: '/opt/google/chrome/chrome', args: ['--disable-gpu'] },
    ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' },
});
