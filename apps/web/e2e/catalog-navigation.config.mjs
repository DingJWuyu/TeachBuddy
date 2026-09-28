import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: fileURLToPath(new URL('.', import.meta.url)), testMatch: 'catalog-navigation.spec.js', workers: 1,
  timeout: 60000, expect: { timeout: 8000 }, reporter: [['list']],
  outputDir: fileURLToPath(new URL('../../../test-results/catalog-navigation', import.meta.url)),
  use: { browserName: 'chromium', actionTimeout: 10000, ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' }
});
