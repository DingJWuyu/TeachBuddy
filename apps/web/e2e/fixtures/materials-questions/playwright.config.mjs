import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "../..",
  testMatch: "materials-questions*.spec.js",
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://localhost:48339",
    launchOptions: {
      args: ["--no-sandbox"],
    },
    viewport: { width: 1440, height: 900 },
  },
  reporter: [["list"]],
  outputDir: "../../../../../test-results/r33/e2e",
});
