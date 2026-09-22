import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "../..",
  testMatch: "math-static*.spec.js",
  testIgnore: "math-static-real.spec.js",
  outputDir: `../../../../../test-results/m41/playwright-${Date.now()}`,
  timeout: 30000,
  workers: 1,
  use: {
    baseURL: "http://localhost:47413",
    headless: true,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "node apps/web/e2e/fixtures/math-static/build.mjs && M41_PORT=47413 M41_DATA_DIR=test-results/m41/browser node apps/web/e2e/fixtures/math-static/server.mjs",
    cwd: "../../../../..",
    url: "http://localhost:47413/api/health",
    reuseExistingServer: false,
  },
});
