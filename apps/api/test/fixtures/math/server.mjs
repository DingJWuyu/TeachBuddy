import fs from "node:fs";
import path from "node:path";
import express from "express";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { createApp } from "../../../src/app.js";
import { moduleCatalog } from "@refatos/shared";
export async function startMathFixture({
  dataDir,
  port = 47411,
  webDist,
  testPrincipals = ["m41-a", "m41-b"],
} = {}) {
  if (process.env.NODE_ENV === "production" || !dataDir)
    throw new Error("Explicit isolated non-production dataDir required");
  fs.mkdirSync(dataDir, { recursive: true });
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "localhost", resolve);
  });
  const origin = `http://localhost:${server.address().port}`;
  let context;
  try {
    context = createApp({
    env: {
      nodeEnv: "test",
      sqlitePath: path.resolve(dataDir, "workbench.sqlite"),
      workbench: {
        mode: "test-principal",
        testPrincipals,
        sessionSecret: "m41-isolated-fixture",
        trustedOrigins: [origin],
        filesDir: path.resolve(dataDir, "files"),
        logDir: path.resolve(dataDir, "logs"),
        catalogOverride: moduleCatalog,
        extraImplementations: {
          math: {
            factory: () => import("../../../src/modules/math/index.js"),
            migrations: () =>
              import("../../../src/modules/math/migrations.js"),
          },
        },
      },
    },
  });
    await context.workbench.initialize();
  } catch (error) {
    server.close();
    await context?.workbench.close();
    throw error;
  }
  const app = express();
  app.get("/fixture/session", (req, res) => {
    res.set(
      "Set-Cookie",
      context.workbench.identity.testPrincipalCookie(
        testPrincipals[req.query.account === "b" ? 1 : 0],
      ).header,
    );
    res.redirect("/?testPrincipal=1");
  });
  if (webDist) app.use(express.static(webDist));
  app.use(context.app);
  server.on("request", app);
  return {
    ...context,
    server,
    origin,
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      await context.workbench.close();
    },
  };
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fixture = await startMathFixture({
    dataDir: process.env.M41_DATA_DIR ?? "test-results/m41/data",
    port: Number(process.env.M41_PORT ?? 47411),
    webDist: path.resolve("apps/web/e2e/fixtures/math-static/dist"),
  });
  console.log(fixture.origin);
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, async () => {
      await fixture.close();
      process.exit(0);
    });
}
