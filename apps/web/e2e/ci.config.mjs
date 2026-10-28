import { defineConfig } from '@playwright/test';

// Current application journeys. Real services and target devices remain explicit
// acceptance work; deterministic regressions use isolated data and local adapters.
export default defineConfig({
  testDir: './rebuilt',
  testMatch: '*.spec.mjs',
  workers: 2,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: '../../../test-results/browser',
  use: {
    browserName: 'chromium',
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
