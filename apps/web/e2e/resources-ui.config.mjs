import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "resources-ui.spec.js",
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  reporter: [["list"]],
  outputDir:
    process.env.RESOURCE_UI_RESULTS || "../../../test-results/resources-ui",
  use: {
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 1000 },
    launchOptions: { executablePath: "/opt/google/chrome/chrome" },
    trace: "retain-on-failure",
  },
});
