import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: fileURLToPath(new URL('.', import.meta.url)), testMatch: 'auth-integration.spec.js', workers: 1,
  timeout: 45000, expect: { timeout: 8000 }, reporter: [['list']],
  outputDir: fileURLToPath(new URL('../../../test-results/a11', import.meta.url)),
  use: { browserName: 'chromium', ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' }
});
