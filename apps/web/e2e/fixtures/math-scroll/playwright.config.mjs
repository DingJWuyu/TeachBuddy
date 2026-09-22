import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '../..',
  testMatch: 'math-scroll*.spec.js',
  workers: 1,
  retries: 0,
  timeout: 120000,
  expect: { timeout: 10000 },
  outputDir: process.env.M43_SCROLL_RESULTS || '../../../../../test-results/math-scroll',
  use: {
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
    trace: 'on',
    screenshot: 'only-on-failure',
  },
});
