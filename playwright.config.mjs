import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './apps/web/e2e',
  fullyParallel: false,
  timeout: 30_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5183',
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure'
  },
  webServer: [
    {
      command: 'node apps/web/e2e/api-server.mjs',
      url: 'http://127.0.0.1:4100/api/health',
      timeout: 120_000,
      reuseExistingServer: false
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5183',
      cwd: 'apps/web',
      url: 'http://127.0.0.1:5183',
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        VITE_API_BASE_URL: 'http://127.0.0.1:4100/api'
      }
    }
  ]
});
