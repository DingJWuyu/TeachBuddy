import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { startFixture } from "../../../scripts/materials/fixture.mjs";
const delay = () => new Promise((r) => setTimeout(r, 15));
test("persistent handlers retain partial units, cancellation, unknown provider and interrupted restart without resending", async (t) => {
  const root = path.resolve("test-results/r31-complete/jobs");
  fs.mkdirSync(root, { recursive: true });
  const directory = fs.mkdtempSync(path.join(root, "case-"));
  let calls = 0,
    mode = "partial",
    release;
  const handler = {
    fixture: true,
    async run({ reportProgress }) {
      calls++;
      reportProgress({ completed: 1, total: 2, unit: "pages" });
      if (mode === "wait")
        await new Promise((r) => {
          release = r;
        });
      return {
        state: "partial",
        outputFileIds: [],
        issues: [
          {
            code:
              mode === "unknown" ? "provider-result-unknown" : "corrupt-file",
            unitId: "text:1:2",
            field: null,
            detail: "明确未完成单元",
          },
        ],
      };
    },
    retry({ principal, job, mutation }) {
      return runtime.workbench.jobs.enqueue(
        { principal, kind: "extraction", target: job.target },
        mutation,
      );
    },
  };
  let runtime = await startFixture({
    dataDir: directory,
    port: 0,
    jobHandlers: { extraction: handler },
  });
  t.after(() => runtime.close());
  const principal = { accountKey: "r31-a" };
  const accept = () =>
    runtime.workbench.mutations.execute(
      {
        principal,
        key: randomUUID(),
        method: "POST",
        path: "/fixture/import",
        body: {},
      },
      () => ({
        status: 202,
        body: runtime.workbench.jobs.enqueue(
          {
            principal,
            kind: "extraction",
            target: { kind: "import", id: randomUUID(), version: 1 },
          },
          {},
        ),
      }),
    ).body;
  const wait = async (id, state) => {
    for (let i = 0; i < 100; i++) {
      const job = runtime.workbench.jobs.get(principal, id);
      if (job.state === state) return job;
      await delay();
    }
    throw Error("state timeout");
  };
  const request = async (id, action, body) => {
    const r = await fetch(
      `http://localhost:${runtime.server.address().port}/api/workbench/jobs/${id}/${action}`,
      {
        method: "POST",
        headers: {
          Cookie: runtime.workbench.identity
            .testPrincipalCookie("r31-a")
            .header.split(";")[0],
          Origin: "http://localhost:0",
          "X-TeachBuddy-Request": "1",
          "Content-Type": "application/json",
          "Idempotency-Key": randomUUID(),
        },
        body: JSON.stringify(body),
      },
    );
    return { status: r.status, body: await r.json() };
  };
  const first = accept();
  await wait(first.id, "partial");
  assert.equal(
    (await request(first.id, "retry", { unitIds: ["text:8:9"] })).status,
    422,
  );
  const retry = await request(first.id, "retry", { unitIds: ["text:1:2"] });
  assert.equal(retry.status, 202);
  assert.equal(retry.body.attemptOf, first.id);
  await wait(retry.body.id, "partial");
  mode = "wait";
  const cancelled = accept();
  await wait(cancelled.id, "running");
  assert.equal(
    (await request(cancelled.id, "cancel", {})).body.state,
    "cancelling",
  );
  release();
  await wait(cancelled.id, "cancelled");
  mode = "unknown";
  const unknown = accept();
  await wait(unknown.id, "partial");
  const before = calls;
  await runtime.close();
  runtime = await startFixture({
    dataDir: directory,
    port: 0,
    jobHandlers: { extraction: handler },
  });
  assert.equal(
    runtime.workbench.jobs.get(principal, unknown.id).issues[0].code,
    "provider-result-unknown",
  );
  await delay();
  assert.equal(calls, before, "unknown provider is not sent again");
  mode = "wait";
  const interrupted = accept();
  await wait(interrupted.id, "running");
  await runtime.close();
  release();
  runtime = await startFixture({
    dataDir: directory,
    port: 0,
    jobHandlers: { extraction: handler },
  });
  assert.equal(
    runtime.workbench.jobs.get(principal, interrupted.id).state,
    "interrupted",
  );
  assert.equal(
    runtime.workbench.jobs.get(principal, interrupted.id).progress.completed,
    1,
  );
  mode = "partial";
  const resumed = await request(interrupted.id, "retry", { unitIds: [] });
  assert.equal(resumed.status, 202);
  await wait(resumed.body.id, "partial");
});

test("four fixed bindings are required and production refuses unconnected business fixtures", async () => {
  const { assertFoundationRuntime } = await import("../src/workbench/index.js");
  const { unconnectedHandlers } =
    await import("../src/workbench/jobs/fixtures.js");
  assert.throws(
    () =>
      assertFoundationRuntime({
        nodeEnv: "production",
        workbench: { mode: "none", jobHandlers: unconnectedHandlers() },
      }),
    /requires preview/,
  );
});

test("the frozen material catalog fixture is version 2 without registering unimplemented modules", async () => {
  const YAML = (await import("yaml")).default;
  const { fileURLToPath } = await import("node:url");
  const schema = YAML.parse(
    fs.readFileSync(
      fileURLToPath(
        new URL(
          "../src/contracts/materials.openapi.yaml",
          import.meta.url,
        ),
      ),
      "utf8",
    ),
  );
  const { validateSchema } = await import("../src/workbench/content/schema.js");
  const fixture = schema.components.examples.ModuleCatalog.value;
  assert.equal(fixture.version, 2);
  assert.deepEqual(
    fixture.items.map((x) => x.id),
    ["questions", "resources", "lessons"],
  );
  assert.equal(validateSchema("ModuleCatalog", fixture), fixture);
});
