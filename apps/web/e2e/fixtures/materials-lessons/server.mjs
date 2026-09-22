import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import { createApp } from "../../../../api/src/app.js";
import { createLessonsModule } from "../../../../api/src/modules/lessons/index.js";
import {
  createGuards,
  asyncHandler,
} from "../../../../api/src/workbench/http.js";
import { materialErrors } from "../../../../api/src/workbench/jobs/router.js";
import { referenceAdapters, examples } from "./adapters.mjs";
import { validateSchema } from "../../../../api/src/workbench/content/schema.js";
export async function start({ dataDir, port = 48434, webDist } = {}) {
  if (!dataDir || process.env.NODE_ENV === "production")
    throw new Error("Isolated R34 data directory required");
  fs.mkdirSync(dataDir, { recursive: true });
  const adapters = referenceAdapters();
  const p = { accountKey: "r34-a" },
    qid = "34000000-0000-4000-8000-000000000001",
    rid = "34000000-0000-4000-8000-000000000002";
  let context;
  context = createApp({
    env: {
      nodeEnv: "test",
      sqlitePath: path.join(dataDir, "workbench.sqlite"),
      workbench: {
        mode: "test-principal",
        testPrincipals: ["r34-a", "r34-b"],
        sessionSecret: "r34-isolated-fixture",
        trustedOrigins: [`http://localhost:${port}`],
        logDir: path.join(dataDir, "logs"),
        extraImplementations: {
          lessons: {
            factory: async () => ({
              createLessonsModule: (deps) =>
                createLessonsModule({
                  ...deps,
                  questions: { ...deps.questions, ...adapters.questionPort },
                  resources: adapters.resourcePort,
                }),
            }),
            migrations: () =>
              import("../../../../api/src/modules/lessons/migrations/index.js"),
          },
        },
      },
    },
  });
  await context.workbench.initialize();
  const file = await context.workbench.files.store(
    p,
    {
      name: "课堂资料.pdf",
      mediaType: "application/pdf",
      bytes: fs.readFileSync(
        new URL("../materials/samples/c22.pdf", import.meta.url),
      ),
    },
    {
      key: "34000000-0000-4000-8000-000000000010",
      method: "POST",
      path: "/fixture/resource-file",
    },
  );
  const paragraph = (text) => ({
    type: "paragraph",
    runs: [{ type: "text", text }],
  });
  adapters.questions.set(qid, {
    id: qid,
    version: 1,
    deletedAt: null,
    snapshot: {
      title: "函数的定义域",
      body: {
        version: 2,
        blocks: [
          {
            type: "paragraph",
            runs: [
              { type: "text", text: "求函数 " },
              { type: "math", latex: "y=\\frac{2x-1}{x+3}" },
              { type: "text", text: " 的定义域。" },
            ],
          },
          {
            type: "math",
            latex: "f(x)=\\begin{cases}x^2&x<0\\\\x+1&x\\ge0\\end{cases}",
          },
        ],
      },
      solution: {
        version: 2,
        blocks: [
          paragraph("Q2 配方仅在答案部分"),
          { type: "math", latex: "x^2-2x=(x-1)^2-1" },
        ],
      },
      answerStatus: "present",
    },
  });
  adapters.resources.set(rid, {
    id: rid,
    version: 1,
    deletedAt: null,
    snapshot: {
      title: "课堂阅读资料",
      fileId: file.id,
      fileName: file.name,
      mediaType: file.mediaType,
      supplementPreviewFileId: null,
    },
  });
  const app = express(),
    guards = createGuards({
      identity: context.workbench.identity,
      trustedOrigins: [`http://localhost:${port}`],
    });
  app.get("/fixture/session", (req, res) => {
    res.set(
      "Set-Cookie",
      context.workbench.identity.testPrincipalCookie("r34-a").header,
    );
    res.redirect("/lessons");
  });
  for (const [kind, base, map, port] of [
    [
      "question",
      "/api/modules/questions/v2/items",
      adapters.questions,
      adapters.questionPort,
    ],
    [
      "resource",
      "/api/modules/resources/items",
      adapters.resources,
      adapters.resourcePort,
    ],
  ]) {
    app.get(base, guards.identityGuard, (req, res) => {
      res.set("Cache-Control", "no-store");
      const rows = [...map.values()].filter(
        (r) =>
          req.workbenchPrincipal.accountKey === "r34-a" &&
          r.snapshot.title.includes(req.query.q ?? ""),
      );
      const items = rows.map((r) => ({
        ...structuredClone(
          kind === "question"
            ? examples.QuestionSavedV2
            : examples.ResourceSaved,
        ),
        ...r,
        ...r.snapshot,
      }));
      items.forEach((item) =>
        validateSchema(kind === "question" ? "Question" : "Resource", item),
      );
      res.json({ items });
    });
    app.get(
      `${base}/:id/for-reference`,
      guards.identityGuard,
      asyncHandler(async (req, res) => {
        res.set("Cache-Control", "no-store");
        res.json(
          port.readForReferenceV2(req.workbenchPrincipal, req.params.id),
        );
      }),
    );
  }
  materialErrors(app);
  app.use((req, res, next) =>
    req.path.startsWith("/api") ? context.app(req, res, next) : next(),
  );
  if (webDist) {
    app.use(express.static(webDist));
    app.get("/{*path}", (req, res) =>
      res.sendFile(path.resolve(webDist, "index.html")),
    );
  }
  const server = app.listen(port, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  return {
    context,
    adapters,
    server,
    close: () =>
      new Promise((r) =>
        server.close(() => {
          context.dataStore.close();
          r();
        }),
      ),
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const runtime = await start({
    dataDir: path.resolve(process.env.R34_DATA_DIR ?? "test-results/r34/data"),
    port: Number(process.env.R34_PORT ?? 48434),
    webDist: path.resolve("test-results/r34/web"),
  });
  console.log(`R34 test-principal http://localhost:${runtime.server.address().port}/fixture/session`);
  process.on("SIGTERM", async () => {
    await runtime.close();
    process.exit(0);
  });
}
