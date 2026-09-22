import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "../..",
  testMatch: ["math-dynamic*.spec.js", "math-isolation*.spec.js"],
  workers: 1,
  timeout: 90000,
  expect: { timeout: 10000 },
  outputDir: "../../../../../test-results/m42/playwright",
  use: {
    headless: true,
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
  },
});
