import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { startFixture } from "/tmp/teacher-r35-local2-candidate/scripts/materials/fixture.mjs";
import { startMathFixture } from "/tmp/teacher-r35-local2-candidate/apps/web/e2e/fixtures/math-static/server.mjs";
import { manualQuestionSample } from "/tmp/teacher-r35-local2-candidate/apps/api/test/first-flow-harness.js";
function describeError(error) {
  if (!error || typeof error !== "object") return error;
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: error.code,
    syscall: error.syscall,
    address: error.address,
    port: error.port,
    socket: error.socket,
    cause: describeError(error.cause),
    errors: error.errors?.map(describeError),
  };
}
test("R31 database upgrade retains files, documents, questions and replay across two restarts", async (t) => {
  const dataDir = `/tmp/teacher-r35-local2-migration-${randomUUID()}`;
  const port = Number(process.env.M41_MIGRATION_PORT ?? 47415);
  fs.mkdirSync(dataDir, { recursive: true });
  let f;
  let phase = "start-r31";
  let lastRequest;
  const request = async (method, path, input, key) => {
    lastRequest = { method, path, origin: f.origin, phase };
    const response = await fetch(f.origin + path, {
      method,
      headers: {
        Cookie: f.workbench.identity
          .testPrincipalCookie("r31-a")
          .header.split(";")[0],
        Origin: f.origin,
        "X-TeachBuddy-Request": "1",
        ...(input
          ? { "Content-Type": "application/json", "Idempotency-Key": key }
          : {}),
      },
      ...(input ? { body: JSON.stringify(input) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    f = await startFixture({ dataDir, port });
    phase = "seed-r31";
    const key = randomUUID(),
      input = manualQuestionSample();
    const question = await request(
      "POST",
      "/api/modules/questions/items",
      input,
      key,
    );
    assert.equal(question.status, 201);
    const doc = {
      version: 2,
      blocks: [
        { type: "paragraph", runs: [{ type: "text", text: "旧 R31 文档" }] },
      ],
    };
    assert.equal(
      (await request("PUT", "/fixture/document", doc, randomUUID())).status,
      200,
    );
    const file = await f.workbench.files.store(
      { accountKey: "r31-a" },
      { name: "original.json", bytes: Buffer.from(JSON.stringify(doc)) },
      { key: randomUUID(), method: "POST", path: "/api/workbench/files" },
    );
    const before = f.workbench.db
      .prepare("SELECT * FROM workbench_migrations")
      .all();
    phase = "close-r31";
    await f.close();
    f = null;
    for (let restart = 0; restart < 2; restart++) {
      phase = `start-math-${restart + 1}`;
      f = await startMathFixture({
        dataDir,
        port,
        testPrincipals: ["r31-a", "r31-b"],
      });
      phase = `replay-math-${restart + 1}`;
      assert.deepEqual(
        await request("POST", "/api/modules/questions/items", input, key),
        question,
      );
      phase = `verify-math-${restart + 1}`;
      assert.deepEqual(
        (
          await request(
            "GET",
            `/api/modules/questions/items/${question.body.id}`,
          )
        ).body,
        question.body,
      );
      assert.deepEqual(
        (await request("GET", `/api/workbench/files/${file.id}`)).body,
        file,
      );
      assert.deepEqual(
        JSON.parse(
          f.workbench.db
            .prepare("SELECT value FROM fixture_documents WHERE accountKey=?")
            .get("r31-a").value,
        ),
        doc,
      );
      const migrations = f.workbench.db
        .prepare("SELECT * FROM workbench_migrations")
        .all();
      assert.deepEqual(migrations.slice(0, before.length), before);
      assert.equal(migrations.filter((m) => m.id === "math_001").length, 1);
      phase = `close-math-${restart + 1}`;
      await f.close();
      f = null;
    }
    fs.writeFileSync(
      `${dataDir}/result.json`,
      JSON.stringify(
        { question: question.body, file, oldMigrations: before, restarts: 2 },
        null,
        2,
      ),
    );
    t.diagnostic(`Retained migration database: ${dataDir}/workbench.sqlite`);
  } catch (error) {
    const failure = {
      node: process.version,
      undici: process.versions.undici,
      dataDir,
      port,
      phase,
      lastRequest,
      listening: f?.server.listening ?? false,
      address: f?.server.address() ?? null,
      error: describeError(error),
    };
    // TAP otherwise omits fetch's nested cause. Keep the original error and
    // database, and record only transport metadata, never cookies or bodies.
    t.diagnostic(JSON.stringify(failure));
    try {
      fs.writeFileSync(`${dataDir}/failure.json`, JSON.stringify(failure, null, 2));
    } catch (writeError) {
      t.diagnostic(`Could not persist failure.json: ${writeError.message}`);
    }
    throw error;
  } finally {
    if (f) await f.close();
  }
});
