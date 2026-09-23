import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "manual-resources.spec.js",
  workers: 1,
  timeout: 120000,
  expect: { timeout: 15000 },
  outputDir: "../../../test-results/manual-resources",
  reporter: [["list"]],
  use: {
    actionTimeout: 15000,
    ignoreHTTPSErrors: true,
    launchOptions: { executablePath: "/opt/google/chrome/chrome" },
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
});
