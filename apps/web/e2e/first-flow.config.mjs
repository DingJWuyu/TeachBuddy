import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: fileURLToPath(new URL('.', import.meta.url)),
  testMatch: ['first-flow.spec.js', 'workspace-acceptance.spec.js'],
  workers: 1, timeout: 60000, expect: { timeout: 10000 }, reporter: 'list',
  outputDir: fileURLToPath(new URL('../../../test-results/first-flow', import.meta.url)),
  use: { actionTimeout: 10000, ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' },
});
