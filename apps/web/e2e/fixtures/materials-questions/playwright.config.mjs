import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "../..",
  testMatch: "materials-questions-fragments.spec.js",
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: process.env.QUESTIONS_FIXTURE_ORIGIN ?? "http://localhost:48339",
    launchOptions: {
      args: ["--no-sandbox"],
    },
    viewport: { width: 1440, height: 900 },
  },
  reporter: [["list"]],
  outputDir: process.env.QUESTIONS_FIXTURE_RESULTS ?? "../../../../../test-results/r33/e2e",
});
