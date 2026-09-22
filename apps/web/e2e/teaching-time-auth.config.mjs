import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './teaching-time-auth', testMatch: '*.spec.js', workers: 1, retries: 0,
  timeout: 60000, expect: { timeout: 8000 }, reporter: [['list'], ['json', { outputFile: process.env.T53_AUTH_REPORT || 'test-results/t53-auth/report.json' }]],
  outputDir: 'test-results/t53-auth/browser',
  use: { browserName: 'chromium', ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, trace: 'off' }
});
