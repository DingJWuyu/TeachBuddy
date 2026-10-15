import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../../../src/app.js";
import https from "node:https";
import { generateSelfSignedCertificate } from "../auth-contract/harness.js";

/** Real default material composition; only identity is substituted for HTTP tests. */
export async function startMaterialsHttp(directory) {
  const context = createApp({
    env: {
      nodeEnv: "test",
      sqlitePath: path.join(directory, "workspace.sqlite"),
      workbench: {
        mode: "test-principal",
        testPrincipals: ["integration-a", "integration-b"],
        sessionSecret: "isolated-material-integration",
        trustedOrigins: ["http://localhost"],
        logDir: path.join(directory, "logs"),
      },
    },
  });
  await context.workbench.initialize();
  const server = context.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  return {
    ...context,
    origin: `http://127.0.0.1:${server.address().port}`,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await context.close();
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.env.NODE_ENV === "production")
    throw new Error("Isolated fake-mail review server only");
  const directory = path.resolve(
    process.env.R34_DATA_DIR ?? "test-results/r34-integration/manual",
  );
  fs.mkdirSync(directory, { recursive: true });
  const server = https.createServer(generateSelfSignedCertificate(directory));
  const sockets = new Set();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise((resolve) =>
    server.listen(Number(process.env.R34_PORT ?? 48436), "127.0.0.1", resolve),
  );
  const origin = `https://127.0.0.1:${server.address().port}`;
  const context = createApp({
    env: {
      nodeEnv: "test",
      sqlitePath: path.join(directory, "workspace.sqlite"),
      authCodeSecret: "isolated-r34-review",
      workbench: {
        publicOrigin: origin,
        webDist: path.resolve("apps/web/dist"),
        logDir: path.join(directory, "logs"),
      },
    },
    sendCode: async (message) => {
      fs.writeFileSync(
        path.join(directory, "mail.json"),
        JSON.stringify(message, null, 2),
      );
    },
  });
  await context.workbench.initialize();
  server.on("request", context.app);
  fs.writeFileSync(
    path.join(directory, "runtime.json"),
    JSON.stringify(
      {
        origin,
        directory,
        identity: "real-auth/fake-mail",
        provider: "unavailable",
      },
      null,
      2,
    ),
  );
  console.log(
    `R34 real-auth / fake-mail: ${origin}\n本地验证码: ${directory}/mail.json`,
  );
  const close = async () => {
    const closed = new Promise((resolve) => server.close(resolve));
    for (const socket of sockets) socket.destroy();
    await closed;
    await context.close();
    process.exit(0);
  };
  process.on("SIGTERM", close);
  process.on("SIGINT", close);
}
