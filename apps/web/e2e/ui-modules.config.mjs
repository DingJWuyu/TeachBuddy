import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.', testMatch: 'ui-modules.spec.js', workers: 1,
  timeout: 60000, expect: { timeout: 10000 },
  outputDir: '../../../test-results/ui-modules', reporter: [['list']],
  use: { actionTimeout: 10000, ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 },
    launchOptions: { executablePath: '/opt/google/chrome/chrome' }, trace: 'retain-on-failure' },
});
