import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: fileURLToPath(new URL('.', import.meta.url)),
  testMatch: 'auth-completeness-*.spec.js', workers: 1, retries: 0,
  timeout: 45000, expect: { timeout: 8000 }, reporter: 'list',
  outputDir: fileURLToPath(new URL('../../../test-results/identity-completeness', import.meta.url)),
  use: {
    browserName: 'chromium', ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure', screenshot: 'only-on-failure',
  },
});
