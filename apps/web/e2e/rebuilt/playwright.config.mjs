import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: '*.spec.mjs', workers: 1, retries: 0,
  timeout: 60_000, expect: { timeout: 10_000 },
  outputDir: `../../../../test-results/test-suite-rebuild/browser/${process.env.BROWSER_RUN_ID ?? Date.now()}`,
  use: { browserName: 'chromium', ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
