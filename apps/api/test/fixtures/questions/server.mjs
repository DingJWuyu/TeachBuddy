import fs from "node:fs";
import path from "node:path";
import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { createApp } from "../../../src/app.js";
import { createQuestionsModule } from "../../../src/modules/questions/index.js";
import { moduleImplementations } from "../../../src/workbench/moduleImplementations.js";
export async function startQuestionsFixture({
  dataDir,
  port = 48339,
  webDist,
  provider,
  principals = ["r33-a", "r33-b"],
} = {}) {
  if (process.env.NODE_ENV === "production")
    throw Error("Isolated questions fixture only");
  if (!dataDir) throw Error("Explicit data directory required");
  fs.mkdirSync(dataDir, { recursive: true });
  let module;
  const wrap = (kind) => ({
    run: (args) => module.jobHandlers[kind].run(args),
    ...(kind === "extraction"
      ? { retry: (args) => module.jobHandlers[kind].retry(args) }
      : {}),
  });
  const origin = `http://localhost:${port}`;
  const context = createApp({
    env: {
      nodeEnv: "test",
      sqlitePath: path.resolve(dataDir, "workbench.sqlite"),
      workbench: {
        mode: "test-principal",
        testPrincipals: principals,
        sessionSecret: "isolated-r33-questions",
        trustedOrigins: [origin],
        filesDir: path.resolve(dataDir, "files"),
        logDir: path.resolve(dataDir, "logs"),
        extraImplementations: {
          questions: {
            ...moduleImplementations.questions,
            factory: async () => ({
              createQuestionsModule: (deps) =>
                (module = createQuestionsModule({ ...deps, provider })),
            }),
          },
        },
        jobHandlers: {
          extraction: wrap("extraction"),
          "question-asset": wrap("question-asset"),
        },
      },
    },
  });
  await context.workbench.initialize();
  const app = express();
  app.get("/fixture/session", (req, res) => {
    res.set(
      "Set-Cookie",
      context.workbench.identity.testPrincipalCookie(principals[0]).header,
    );
    res.redirect("/");
  });
  if (webDist) app.use(express.static(webDist));
  app.use(context.app);
  const server = createServer(app);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "localhost", resolve);
  });
  return {
    ...context,
    module,
    server,
    origin,
    async close() {
      await new Promise((r) => server.close(r));
      await context.close();
    },
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const runtime = await startQuestionsFixture({
    dataDir: process.argv[2] ?? "test-results/r33/data",
    port: Number(process.argv[3] ?? 48339),
    webDist: path.resolve("test-results/r33/web"),
  });
  console.log(runtime.origin);
  for (const event of ["SIGINT", "SIGTERM"])
    process.on(event, async () => {
      await runtime.close();
      process.exit();
    });
}
