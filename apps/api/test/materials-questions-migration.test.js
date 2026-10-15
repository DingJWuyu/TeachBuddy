import os from 'node:os';
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { extractLegacySource } from "./fixtures/legacy-source/extract.mjs";
import { startQuestionsFixture } from "./fixtures/questions/server.mjs";
test("fixed R31 v1 database upgrades preserving original request replay, IDs and documents", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "r33-upgrade-"));
  let runtime, passed = false;
  t.after(async () => {
    await runtime?.close();
    if (passed) fs.rmSync(root, { recursive: true, force: true });
    else console.error("Retained R31 questions migration:", root);
  });
  const source = extractLegacySource("r31-questions", path.join(root, "source"));
  const { startFixture } = await import(pathToFileURL(path.join(source, "scripts/materials/fixture.mjs")));
  const dataDir = path.join(root, "instance");
  runtime = await startFixture({ dataDir, port: 0 });
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
  runtime = null;
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
  runtime = null;
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
  const evidence = "test-results/evidence/R33/v1";
  fs.mkdirSync(evidence, { recursive: true });
  fs.writeFileSync(
    path.join(evidence, "migration.json"),
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
  passed = true;
});
