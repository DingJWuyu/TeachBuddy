import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.js",
  workers: 1,
  timeout: 120000,
  expect: { timeout: 10000 },
  outputDir: "../../../../test-results/manual-data",
  reporter: [["list"]],
  use: {
    actionTimeout: 10000,
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
});
