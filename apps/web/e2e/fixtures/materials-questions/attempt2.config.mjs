import config from "./playwright.config.mjs";
export default {
  ...config,
  use: { ...config.use, baseURL: "http://localhost:48349" },
  outputDir: "../../../../../test-results/r33-attempt2/e2e",
};
