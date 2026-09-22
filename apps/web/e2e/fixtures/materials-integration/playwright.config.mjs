import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: fileURLToPath(new URL("../..", import.meta.url)),
  testMatch: "materials-integration*.spec.js",
  workers: 1,
  timeout: 180000,
  expect: { timeout: 15000 },
  reporter: [["list"]],
  outputDir: fileURLToPath(
    new URL(
      "../../../../../test-results/r34-integration/browser",
      import.meta.url,
    ),
  ),
  use: {
    browserName: "chromium",
    launchOptions: { executablePath: "/opt/google/chrome/chrome" },
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
});
