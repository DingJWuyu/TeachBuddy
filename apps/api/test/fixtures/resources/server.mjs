import fs from "node:fs";
import path from "node:path";
import express from "express";
import { createServer } from "node:http";
import { createWorkbench } from "../../../src/workbench/index.js";
import {
  createGuards,
  createWorkbenchErrorHandler,
} from "../../../src/workbench/http.js";

export async function startResourcesFixture({
  dataDir,
  port = 48432,
  webDist,
} = {}) {
  if (!dataDir || process.env.NODE_ENV === "production")
    throw new Error("Isolated test data directory required");
  fs.mkdirSync(dataDir, { recursive: true });
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "localhost", resolve);
  });
  const origin = `http://localhost:${server.address().port}`;
  let workbench;
  try {
    workbench = createWorkbench({
      env: {
        nodeEnv: "test",
        sqlitePath: path.join(dataDir, "resources.sqlite"),
        workbench: {
          mode: "test-principal",
          testPrincipals: ["r32-a", "r32-b"],
          sessionSecret: "isolated-r32-fixture",
          trustedOrigins: [origin],
          filesDir: path.join(dataDir, "files"),
          logDir: path.join(dataDir, "logs"),
        },
      },
    });
    await workbench.initialize();
  } catch (error) {
    await new Promise(resolve => server.close(resolve));
    await workbench?.close();
    throw error;
  }
  const app = express();
  const guards = createGuards({
    identity: workbench.identity,
    trustedOrigins: [origin],
  });
  app.get("/fixture/session", (req, res) => {
    res.set(
      "Set-Cookie",
      workbench.identity.testPrincipalCookie(
        req.query.account === "b" ? "r32-b" : "r32-a",
      ).header,
    );
    res.redirect("/");
  });
  app.use(
    "/api/modules/resources",
    (req, res, next) => {
      res.set("Cache-Control", "no-store");
      next();
    },
    (req, res, next) =>
      ["POST", "PUT"].includes(req.method)
        ? guards.originGuard(req, res, next)
        : next(),
    guards.protectionGuard,
    guards.identityGuard,
    express.json({ limit: "2mb" }),
  );
  const resources = workbench.loader.get("resources");
  app.use("/api/modules/resources", resources.router);
  app.use("/api/workbench/files", workbench.filesRouter);
  app.use("/api/workbench/jobs", workbench.jobsRouter);
  app.use("/api/workbench", workbench.contextRouter);
  app.use(createWorkbenchErrorHandler());
  if (webDist) app.use(express.static(webDist));
  server.on("request", app);
  return {
    origin,
    workbench,
    resources,
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      await workbench.close();
    },
  };
}
