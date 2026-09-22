import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { startQuestionsFixture } from "../../web/e2e/fixtures/materials-questions/server.mjs";
test("fixed R31 v1 database upgrades preserving original request replay, IDs and documents", async (t) => {
  const source = "/home/liam_t/项目/TeacherWorkspace-r31-complete";
  if (!fs.existsSync(source)) {
    t.skip("fixed R31 source unavailable");
    return;
  }
  assert.equal(
    execFileSync("git", ["-C", source, "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    "2b6cbcda934057a89c0443437e03b2e30e850a8d",
  );
  const { startFixture } = await import(
    source + "/scripts/materials/fixture.mjs"
  );
  const dataDir = fs.mkdtempSync("/tmp/r33-upgrade-");
  let runtime = await startFixture({ dataDir, port: 0 });
  t.after(() => runtime.close());
  const request = async (path, body, method = "POST", key = randomUUID()) => {
    const r = await fetch(
      `http://localhost:${runtime.server.address().port}` + path,
      {
        method,
        headers: {
          Cookie: runtime.workbench.identity
            .testPrincipalCookie("r31-a")
            .header.split(";")[0],
          Origin: "http://localhost:0",
          "X-TeachBuddy-Request": "1",
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    return { status: r.status, body: await r.json() };
  };
  const doc = {
    version: 1,
    blocks: [{ type: "paragraph", runs: [{ type: "text", text: "旧题原文" }] }],
  };
  const input = {
    title: "旧题",
    body: doc,
    solution: { version: 1, blocks: [] },
    note: "旧笔记",
    starred: true,
    source: { kind: "manual" },
  };
  const key = randomUUID();
  const before = await request(
    "/api/modules/questions/items",
    input,
    "POST",
    key,
  );
  assert.equal(before.status, 201);
  await runtime.close();
  runtime = await startQuestionsFixture({
    dataDir,
    port: 0,
    principals: ["r31-a", "r33-b"],
  });
  const migrated = (
    await request(
      "/api/modules/questions/v2/items/" + before.body.id,
      null,
      "GET",
    )
  ).body;
  assert.deepEqual(migrated.body, doc);
  assert.equal(migrated.version, 1);
  assert.equal(migrated.note, "旧笔记");
  assert.equal(migrated.answerStatus, "absent");
  assert.equal(migrated.typeId, null);
  assert.deepEqual(
    await request("/api/modules/questions/items", input, "POST", key),
    before,
  );
  await runtime.close();
  runtime = await startQuestionsFixture({
    dataDir,
    port: 0,
    principals: ["r31-a", "r33-b"],
  });
  assert.deepEqual(
    (
      await request(
        "/api/modules/questions/v2/items/" + before.body.id,
        null,
        "GET",
      )
    ).body,
    migrated,
  );
  fs.writeFileSync(
    new URL(
      "../../../docs/acceptance/evidence/R33/v1/attempt2/migration.json",
      import.meta.url,
    ),
    JSON.stringify(
      {
        sourceRevision: "2b6cbcda934057a89c0443437e03b2e30e850a8d",
        identity: "test-principal",
        id: migrated.id,
        v1DocumentPreserved: true,
        oldRequestReplayPreserved: true,
        restartPreserved: true,
        dataDir,
      },
      null,
      2,
    ),
  );
});
