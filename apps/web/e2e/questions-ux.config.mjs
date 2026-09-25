import { defineConfig } from '@playwright/test';

if (!process.env.WORKBENCH_WEB_DIST) throw new Error('请用 WORKBENCH_WEB_DIST 指定隔离生产构建。');

export default defineConfig({
  testDir: '.', testMatch: 'questions-ux.spec.js', workers: 1,
  timeout: 60000, expect: { timeout: 10000 }, reporter: 'list',
  outputDir: `../../../test-results/questions-ux/${Date.now()}`,
  use: { ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 },
    launchOptions: { executablePath: '/opt/google/chrome/chrome' }, trace: 'retain-on-failure' },
});
