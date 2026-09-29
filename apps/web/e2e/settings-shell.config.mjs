import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: '.', testMatch: 'settings-shell.spec.js', workers: 1, timeout: 90000,
  expect: { timeout: 10000 }, reporter: 'list', outputDir: '../../../test-results/settings-shell',
  use: { ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' } });
