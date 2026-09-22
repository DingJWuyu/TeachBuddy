import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: fileURLToPath(new URL('.', import.meta.url)),
  testMatch: 'r31-math-support.spec.js', workers: 1,
  timeout: 45000, expect: { timeout: 8000 }, reporter: [['list']],
  outputDir: fileURLToPath(new URL('../../../test-results/r31-math-support/playwright', import.meta.url)),
  use: { browserName: 'chromium', ignoreHTTPSErrors: true, viewport: { width: 1200, height: 800 } }
});
