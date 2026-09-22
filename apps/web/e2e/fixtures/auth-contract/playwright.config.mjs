import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../../../..');

/*
 * Fixture-only Playwright configuration. The account-contract specs run
 * against the substitute HTTP server and the production harness bundle; the
 * repository's shared playwright.config.mjs is untouched.
 */
export default defineConfig({
  testDir: path.resolve(HERE, '../..'),
  testMatch: /auth-contract.*\.spec\.js$/,
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:47182',
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure',
    ignoreHTTPSErrors: true,
  },
  webServer: {
    command: 'node apps/web/e2e/fixtures/auth-contract/substitute-server.mjs --port 47182 --build',
    url: 'http://127.0.0.1:47182/__fixture/health',
    cwd: REPO_ROOT,
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
