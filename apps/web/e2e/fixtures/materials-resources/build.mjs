import { build } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
await build({
  configFile: false,
  root: path.resolve("apps/web/e2e/fixtures/materials-resources"),
  plugins: [react()],
  build: {
    outDir: path.resolve("test-results/r32-browser/web"),
    emptyOutDir: true,
  },
});
