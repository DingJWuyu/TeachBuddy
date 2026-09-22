import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "../..",
  testMatch: "materials-resources*.spec.js",
  workers: 1,
  timeout: 120000,
  reporter: [["list"]],
  outputDir: "../../../../../test-results/r32-playwright",
  use: {
    baseURL: "http://localhost:48433",
    headless: true,
    actionTimeout: 15000,
    trace: "retain-on-failure",
  },
});
