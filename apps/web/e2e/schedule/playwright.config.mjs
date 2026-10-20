import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  testDir: '..', testMatch: 'schedule/*.spec.js', workers: 2, retries: 0,
  timeout: 60000, expect: { timeout: 10000 },
  outputDir: fileURLToPath(new URL('../../../../test-results/schedule', import.meta.url)), reporter: [['list']],
  use: {
    ignoreHTTPSErrors: true,
    viewport: { width: 1675, height: 950 },
    trace: 'retain-on-failure', screenshot: 'only-on-failure',
  },
});
