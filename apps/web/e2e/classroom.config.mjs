import { defineConfig } from '@playwright/test';

if (!process.env.WORKBENCH_WEB_DIST) throw new Error('请用 WORKBENCH_WEB_DIST 指定隔离生产构建。');

export default defineConfig({
  testDir: '.', testMatch: 'classroom.spec.js', workers: 1,
  timeout: 120000, expect: { timeout: 10000 }, reporter: 'list',
  outputDir: process.env.CLASSROOM_OUTPUT_DIR ?? `../../../test-results/classroom/${Date.now()}`,
  use: { ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
