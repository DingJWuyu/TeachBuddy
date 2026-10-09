import { defineConfig } from '@playwright/test';

// Real product, local source-built GGB, and isolated real authentication.
export default defineConfig({
  testDir: '.',
  testMatch: 'math-geogebra*.spec.js',
  workers: 1,
  timeout: 240000,
  expect: { timeout: 10000 },
  outputDir: '../../../test-results/math-unified/ui/protection',
  reporter: [['list']],
  use: { ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, actionTimeout: 10000, trace: 'retain-on-failure' },
});
