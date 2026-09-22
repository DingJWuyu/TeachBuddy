import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "../..",
  testMatch: "materials-lessons*.spec.js",
  workers: 1,
  retries: 0,
  timeout: 60000,
  use: {
    baseURL: "http://localhost:48434",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  outputDir: "../../../../../test-results/r34/playwright",
});
