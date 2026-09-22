import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "../..",
  testMatch: "materials-teaching.spec.js",
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  outputDir: "../../../../../test-results/mta",
  use: {
    launchOptions: { executablePath: "/opt/google/chrome/chrome" },
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
});
