import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
export default defineConfig({ testDir: '.', testMatch: '*.spec.js', workers: 1, timeout: 60000,
  expect: { timeout: 8000 }, reporter: 'list', outputDir: fileURLToPath(new URL('../../../../test-results/manual-support', import.meta.url)),
  use: { actionTimeout: 10000, ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' } });
