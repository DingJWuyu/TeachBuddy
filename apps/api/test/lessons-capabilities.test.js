import test from "node:test";
import Database from "better-sqlite3";
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
    await send("POST", exportUrl, { ...exportOptions, resourcePageReferenceIds: [copy.sections[0].references[0].id] }, 422);
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

test("lesson history and section reuse preserve trusted snapshots, placement, isolation and replay across restart", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "lessons-history-"));
  let world = await startMaterialsHttp(directory), passed = false;
  async function send(method, route, body, status = 200, key = randomUUID(), owner = "integration-a") {
    const response = await fetch(world.origin + route, { method, headers: {
      Cookie: world.workbench.identity.testPrincipalCookie(owner).header.split(";")[0],
      Origin: "http://localhost", "X-TeachBuddy-Request": "1", "Idempotency-Key": key,
      ...(body ? { "Content-Type": "application/json" } : {}),
    }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json();
    assert.equal(response.status, status, JSON.stringify(result)); return result;
  }
  const writable = lesson => ({ baseVersion: lesson.version, title: lesson.title, intro: lesson.intro,
    sections: lesson.sections.map(s => ({ ...s, references: s.references.map(r => ({
      id: r.id, kind: r.kind, questionId: r.questionId, questionVersion: r.questionVersion, note: r.note, afterBlock: r.afterBlock,
    })) })), materials: [] });
  try {
    const q = await send("POST", "/api/modules/questions/v2/items", question("旧题面"), 201);
    const ref = { id: randomUUID(), kind: "question", questionId: q.id, questionVersion: 1, note: "原课备注", afterBlock: 1 };
    let original = await send("POST", base, { title: "原课第一稿", intro: doc("原思路"), materials: [], sections: [{
      id: randomUUID(), title: "可复用环节", content: { version: 1, blocks: [...doc("先讲").blocks, ...doc("后练").blocks] }, references: [ref],
    }] }, 201);
    const originalFirst = structuredClone(original), url = `${base}/${original.id}`;
    let edit = writable(original); edit.title = "第二稿";
    // An older client omitting the optional placement must not erase it.
    delete edit.sections[0].references[0].afterBlock;
    original = await send("PUT", url, edit);
    assert.equal(original.sections[0].references[0].afterBlock, 1);
    edit = writable(original); edit.sections[0].references[0].afterBlock = 99;
    await send("PUT", url, edit, 422);
    assert.equal((await send("GET", `${url}/history`)).items.length, 2);
    edit = writable(original); edit.sections = []; original = await send("PUT", url, edit);
    await send("POST", `/api/modules/questions/v2/items/${q.id}/deletion`, { baseVersion: 1, deleted: true });
    await send("POST", `/api/modules/questions/v2/items/${q.id}/purge`, { baseVersion: 2 });
    const old = await send("GET", `${url}/history/1`);
    assert.deepEqual(old.sections[0].references[0].snapshot, originalFirst.sections[0].references[0].snapshot);
    await send("GET", `${url}/history`, undefined, 404, randomUUID(), "integration-b");
    await send("GET", `${url}/history/1`, undefined, 404, randomUUID(), "integration-b");
    await send("POST", `${url}/history/restore`, { baseVersion: 2, version: 1 }, 409);
    await send("POST", `${url}/history/restore`, { baseVersion: 3, version: 999 }, 404);
    const key = randomUUID(), restore = { baseVersion: 3, version: 1 };
    original = await send("POST", `${url}/history/restore`, restore, 200, key);
    assert.equal(original.version, 4); assert.equal(original.title, "原课第一稿");
    assert.equal(original.sections[0].references[0].afterBlock, 1);
    assert.deepEqual(original.sections, old.sections);
    assert.deepEqual(await send("POST", `${url}/history/restore`, restore, 200, key), original);
    const target = await send("POST", base, { title: "目标课稿", intro: doc("保留目标"), sections: [], materials: [] }, 201);
    const copyInput = { baseVersion: 1, sourceLessonId: original.id, sourceVersion: 4, sectionIds: [original.sections[0].id] };
    const copyUrl = `${base}/${target.id}/sections/copy`;
    await send("POST", copyUrl, { ...copyInput, sourceVersion: 3 }, 409);
    await send("POST", copyUrl, { ...copyInput, sectionIds: [randomUUID()] }, 422);
    await send("POST", copyUrl, { ...copyInput, sectionIds: [copyInput.sectionIds[0], copyInput.sectionIds[0]] }, 422);
    await send("POST", copyUrl, copyInput, 404, randomUUID(), "integration-b");
    const copyKey = randomUUID(), copy = await send("POST", copyUrl, copyInput, 200, copyKey);
    assert.equal(copy.version, 2); assert.equal(copy.title, target.title);
    assert.notEqual(copy.sections[0].id, original.sections[0].id);
    assert.notEqual(copy.sections[0].references[0].id, original.sections[0].references[0].id);
    assert.deepEqual(copy.sections[0].references[0].snapshot, old.sections[0].references[0].snapshot);
    assert.equal(copy.sections[0].references[0].note, "原课备注");
    assert.equal(copy.sections[0].references[0].afterBlock, 1);
    await world.close(); world = await startMaterialsHttp(directory);
    assert.deepEqual(await send("POST", copyUrl, copyInput, 200, copyKey), copy);
    assert.equal((await send("GET", `${url}/history`)).items.length, 4);
    assert.equal((await send("GET", `${url}/history/2`)).title, "第二稿");
    original = await send("POST", `${url}/deletion`, { baseVersion: 4, deleted: true });
    await send("POST", `${url}/history/restore`, { baseVersion: 5, version: 1 }, 409);
    await send("POST", `${url}/purge`, { baseVersion: 5 });
    await send("GET", `${url}/history/1`, undefined, 404);
    assert.equal((await send("GET", `${base}/${copy.id}`)).sections.length, 1);
    // History has a visible fixed retention bound; failed mutations above add no entries.
    let current = copy;
    for (let i = 0; i < 52; i++) current = await send("PUT", `${base}/${current.id}`, { ...writable(current), title: `保存 ${i}` });
    const history = await send("GET", `${base}/${current.id}/history`);
    assert.equal(history.items.length, 50); assert.equal(history.limit, 50);
    assert.equal(history.items[0].version, current.version);
    await send("GET", `${base}/${current.id}/history/1`, undefined, 404);
    passed = true;
  } finally { await world.close(); if (passed) fs.rmSync(directory, { recursive: true, force: true }); }
});

test("existing lessons migrate without changing content and begin history at their current saved version", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "lessons-upgrade-"));
  let world = await startMaterialsHttp(directory), passed = false;
  const send = async (method, route, body) => {
    const response = await fetch(world.origin + route, { method, headers: {
      Cookie: world.workbench.identity.testPrincipalCookie("integration-a").header.split(";")[0],
      Origin: "http://localhost", "X-TeachBuddy-Request": "1", "Idempotency-Key": randomUUID(), "Content-Type": "application/json",
    }, ...(body ? { body: JSON.stringify(body) } : {}) });
    assert.ok(response.ok); return response.json();
  };
  try {
    const input = { title: "已有备课", intro: doc("已有思路"), sections: [], materials: [] };
    const original = await send("POST", base, input), url = `${base}/${original.id}`;
    await world.close();
    // Recreate the immediately preceding persisted schema with the existing row intact.
    const db = new Database(path.join(directory, "workspace.sqlite"));
    db.transaction(() => {
      db.exec("DROP TABLE lesson_history; ALTER TABLE lesson_references DROP COLUMN afterBlock");
      db.prepare("DELETE FROM workbench_migrations WHERE id=?").run("lessons_0004_history_and_placement");
    })(); db.close();
    world = await startMaterialsHttp(directory);
    assert.deepEqual(await send("GET", url), original);
    assert.deepEqual((await send("GET", `${url}/history`)).items.map(i => i.version), [1]);
    await send("PUT", url, { baseVersion: 1, ...input, title: "升级后的保存" });
    assert.deepEqual(await send("GET", `${url}/history/1`), original);
    assert.deepEqual((await send("GET", `${url}/history`)).items.map(i => i.version), [2, 1]);
    passed = true;
  } finally { await world.close(); if (passed) fs.rmSync(directory, { recursive: true, force: true }); }
});
