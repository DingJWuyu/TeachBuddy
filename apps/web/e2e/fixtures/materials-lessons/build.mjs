import { build } from "vite";
import path from "node:path";
await build({
  root: path.resolve("apps/web/e2e/fixtures/materials-lessons"),
  configFile: false,
  build: { outDir: path.resolve("test-results/r34/web"), emptyOutDir: true },
  publicDir: path.resolve("apps/web/public"),
});
