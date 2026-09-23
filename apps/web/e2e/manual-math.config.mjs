import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "manual-math.spec.js",
  workers: 1,
  timeout: 90000,
  expect: { timeout: 10000 },
  outputDir: "../../../test-results/manual-math",
  reporter: [["list"]],
  use: {
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
});
