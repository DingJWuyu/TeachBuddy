import fs from "node:fs";
import { lessonsAdapter } from "./lessons-adapter.mjs";
import path from "node:path";
import express from "express";
import YAML from "yaml";
import { moduleCatalog } from "@refatos/shared";
import { createServer } from "node:http";
import { createWorkbench } from "../../../../api/src/workbench/index.js";
import {
  createGuards,
  createWorkbenchErrorHandler,
} from "../../../../api/src/workbench/http.js";

export async function startResourcesFixture({
  dataDir,
  port = 48432,
  webDist,
} = {}) {
  if (!dataDir || process.env.NODE_ENV === "production")
    throw new Error("Isolated test data directory required");
  fs.mkdirSync(dataDir, { recursive: true });
  const origin = `http://localhost:${port}`;
  const workbench = createWorkbench({
    env: {
      nodeEnv: "test",
      sqlitePath: path.join(dataDir, "resources.sqlite"),
      workbench: {
        catalogOverride: [
          ...moduleCatalog.filter((item) => item.id !== "resources"),
          YAML.parse(
            fs.readFileSync(
              new URL(
                "../../../../api/src/contracts/materials.openapi.yaml",
                import.meta.url,
              ),
              "utf8",
            ),
          ).components.examples.ModuleCatalog.value.items.find(
            (item) => item.id === "resources",
          ),
        ],
        extraImplementations: {
          resources: {
            factory: () =>
              import("../../../../api/src/modules/resources/index.js"),
            migrations: () =>
              import(
                "../../../../api/src/modules/resources/migrations/index.js"
              ),
          },
        },
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
  app.use(
    ["/fixture/adopt", "/fixture/references", "/api/modules/lessons/v2", "/api/modules/lessons/v3"],
    guards.protectionGuard,
    guards.identityGuard,
    express.json(),
  );
  app.use(
    lessonsAdapter({
      db: workbench.db,
      resources: resources.port,
      mutations: workbench.mutations,
    }),
  );
  app.use("/api/workbench/files", workbench.filesRouter);
  app.use("/api/workbench/jobs", workbench.jobsRouter);
  app.use("/api/workbench", workbench.contextRouter);
  app.use(createWorkbenchErrorHandler());
  if (webDist) app.use(express.static(webDist));
  const server = createServer(app);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "localhost", resolve);
  });
  return {
    origin,
    workbench,
    resources,
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      workbench.close();
    },
  };
}
