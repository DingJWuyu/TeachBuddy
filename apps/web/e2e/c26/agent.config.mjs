import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: fileURLToPath(new URL('.', import.meta.url)), testMatch: '*.spec.js', workers: 1, timeout: 45000,
  outputDir: fileURLToPath(new URL('../../../../test-results/c26/browser', import.meta.url)), use: { browserName: 'chromium', ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' } });
