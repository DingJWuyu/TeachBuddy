import { build } from "vite";
import path from "node:path";
import { prepareMathAssets } from "../../../../../scripts/math-support/prepare-assets.mjs";
await prepareMathAssets();
await build({
  configFile: false,
  publicDir: path.resolve("apps/web/public"),
  root: path.resolve("apps/web/e2e/fixtures/math-static"),
  build: { outDir: "dist", emptyOutDir: true },
});
