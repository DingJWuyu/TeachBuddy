import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { startFixture } from "../../../scripts/materials/fixture.mjs";
import { startMathFixture } from "../../web/e2e/fixtures/math-static/server.mjs";
import { manualQuestionSample } from "./first-flow-harness.js";
test("R31 database upgrade retains files, documents, questions and replay across two restarts", async () => {
  const dataDir = `test-results/m41/migration-${randomUUID()}`;
  fs.mkdirSync(dataDir, { recursive: true });
  let f = await startFixture({ dataDir, port: 47415 });
  const request = async (method, path, input, key) => {
    const response = await fetch(f.origin + path, {
      method,
      headers: {
      // Do not carry a pooled socket across the fixture server lifecycle.
      Connection: "close",
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
    await f.close();
    f = null;
    for (let restart = 0; restart < 2; restart++) {
      f = await startMathFixture({
        dataDir,
        port: 47415,
        testPrincipals: ["r31-a", "r31-b"],
      });
      assert.deepEqual(
        await request("POST", "/api/modules/questions/items", input, key),
        question,
      );
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
  } finally {
    if (f) await f.close();
  }
});
