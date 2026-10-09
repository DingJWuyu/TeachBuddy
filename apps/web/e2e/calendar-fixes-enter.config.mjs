import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: ['calendar-graph-audit.spec.js', 'calendar-graph-races.spec.js', 'calendar-keyboard.spec.js'],
  workers: 2, retries: 0, timeout: 40000, expect: { timeout: 7000 },
  outputDir: '../../../test-results/schedule-fixes-enter/results',
  reporter: [['list'], ['json', { outputFile: new URL('../../../test-results/schedule-fixes-enter/results.json', import.meta.url).pathname }]],
  use: { ignoreHTTPSErrors: true, viewport: { width: 1675, height: 950 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' }
});
