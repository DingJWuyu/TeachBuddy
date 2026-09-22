import config from "./playwright.config.mjs";
export default {
  ...config,
  use: { ...config.use, baseURL: "http://localhost:48449" },
  outputDir: "../../../../../test-results/r33-attempt4/e2e",
};
