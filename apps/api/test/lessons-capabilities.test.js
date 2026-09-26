import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { startMaterialsHttp } from "../../web/e2e/fixtures/materials-integration/server.mjs";
import { question, doc } from "./teaching-time-classes-materials-fixture.js";

const base = "/api/modules/lessons/v3";
test("lesson copy preserves adopted snapshots with independent identities and validates owner/version/idempotency", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "lessons-capabilities-"));
  let world = await startMaterialsHttp(directory);
  let passed = false;
  async function send(method, route, body, status = 200, key = randomUUID(), owner = "integration-a") {
    const response = await fetch(world.origin + route, {
      method, headers: {
        Cookie: world.workbench.identity.testPrincipalCookie(owner).header.split(";")[0],
        Origin: "http://localhost", "X-TeachBuddy-Request": "1", "Idempotency-Key": key,
        ...(body ? { "Content-Type": "application/json" } : {}),
      }, ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    assert.equal(response.status, status, JSON.stringify(result));
    return result;
  }
  try {
    const source = await send("POST", "/api/modules/questions/v2/items", question("固定题面"), 201);
    const ref = { id: randomUUID(), kind: "question", questionId: source.id, questionVersion: 1, note: "保留备注" };
    const input = { title: "原课稿", intro: doc("原始思路"), materials: [{ ...ref, id: randomUUID() }],
      sections: [{ id: randomUUID(), title: "独立环节", content: doc("环节正文"), references: [ref] }] };
    const original = await send("POST", base, input, 201);
    const url = `${base}/${original.id}/copy`;
    await send("POST", url, { baseVersion: 1 }, 404, randomUUID(), "integration-b");
    await send("POST", url, { baseVersion: 999 }, 409);
    await send("POST", url, { baseVersion: 1, snapshot: {} }, 422);
    await send("POST", `/api/modules/questions/v2/items/${source.id}/deletion`, { baseVersion: 1, deleted: true });
    await send("POST", `/api/modules/questions/v2/items/${source.id}/purge`, { baseVersion: 2 });
    const key = randomUUID();
    const copy = await send("POST", url, { baseVersion: 1 }, 201, key);
    assert.notEqual(copy.id, original.id);
    assert.notEqual(copy.sections[0].id, original.sections[0].id);
    assert.notEqual(copy.sections[0].references[0].id, original.sections[0].references[0].id);
    assert.notEqual(copy.materials[0].id, original.materials[0].id);
    assert.deepEqual(copy.sections[0].references[0].snapshot, original.sections[0].references[0].snapshot);
    assert.equal(copy.sections[0].references[0].questionVersion, 1);
    assert.equal(copy.sections[0].references[0].note, "保留备注");
    assert.equal(copy.title, "原课稿（副本）");
    assert.deepEqual(await send("GET", `${base}/${copy.id}/exports`), { items: [] });
    assert.deepEqual(await send("POST", url, { baseVersion: 1 }, 201, key), copy);
    await send("POST", url, { baseVersion: 2 }, 409, key);
    assert.equal((await send("GET", base)).items.length, 2);
    const exportOptions = { baseVersion: 1, kind: "practice", format: "docx", includeAnswers: false,
      includeTeacherNotes: false, sectionIds: [copy.sections[0].id], materialReferenceIds: [], answerSpaceLines: 0 };
    const exportUrl = `${base}/${copy.id}/exports`;
    await send("POST", exportUrl, { ...exportOptions, excludedReferenceIds: [randomUUID()] }, 422);
    await send("POST", exportUrl, { ...exportOptions, excludedReferenceIds: [copy.sections[0].references[0].id] }, 422);
    const override = { referenceId: copy.sections[0].references[0].id, lines: 3 };
    await send("POST", exportUrl, { ...exportOptions, answerSpaceOverrides: [override, override] }, 422);
    await send("POST", exportUrl, { ...exportOptions, answerSpaceOverrides: [{ ...override, lines: 21 }] }, 422);
    await send("POST", exportUrl, { ...exportOptions, answerSpaceOverrides: [{ ...override, referenceId: randomUUID() }] }, 422);
    assert.deepEqual(await send("GET", `${base}/${copy.id}/exports`), { items: [] });
    await send("POST", `${base}/${original.id}/deletion`, { baseVersion: 1, deleted: true });
    const restoredCopy = await send("POST", url, { baseVersion: 2 }, 201);
    assert.equal(restoredCopy.deletedAt, null);
    assert.equal((await send("GET", `${base}/${original.id}`)).deletedAt !== null, true);
    await world.close();
    world = await startMaterialsHttp(directory);
    assert.deepEqual(await send("GET", `${base}/${copy.id}`), copy);
    assert.deepEqual(await send("POST", url, { baseVersion: 1 }, 201, key), copy);
    assert.equal((await send("GET", base)).items.length, 2);
    passed = true;
  } finally {
    await world.close();
    if (passed) fs.rmSync(directory, { recursive: true, force: true });
  }
});
