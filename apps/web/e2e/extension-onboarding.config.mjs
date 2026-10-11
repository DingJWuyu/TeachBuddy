import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'extension-onboarding.spec.js', workers: 1, timeout: 90000,
  expect: { timeout: 12000 }, outputDir: '../../../test-results/math-ai-onboarding/core-fix/results',
  reporter: [['list']],
  use: { ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 },
    actionTimeout: 10000, trace: 'retain-on-failure' },
});
