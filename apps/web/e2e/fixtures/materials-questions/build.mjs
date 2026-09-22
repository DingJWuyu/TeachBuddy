import { build } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
await build({
  configFile: false,
  root: path.resolve("apps/web/e2e/fixtures/materials-questions"),
  plugins: [react()],
  build: { outDir: path.resolve("test-results/r33/web"), emptyOutDir: true },
});
