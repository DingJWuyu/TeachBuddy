import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import JSZip from "jszip";
import Database from "better-sqlite3";
import { createIntegration } from "./fixtures/auth-integration/harness.js";
import { registerMath } from "../../web/e2e/fixtures/math-static/real.mjs";
import { emptySource } from "../../web/src/features/math/model.js";
import { doc, question, http, writable, Q } from "./teaching-time-classes-materials-fixture.js";
import { backup, restore, activate } from "../src/workbench/reliability/backup.js";

const lessons = "/api/modules/lessons/v3";
const email = "snapshots@example.test";

async function prepare() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "material-snapshots-"));
  const world = await createIntegration({ directory });
  try {
    const { client, session } = await registerMath(world, email);
    const call = http(client);
    const boundary = `snapshot-${randomUUID()}`;
    const png = fs.readFileSync(new URL("../../web/e2e/fixtures/materials-questions/figure.png", import.meta.url));
    const upload = await client.request("POST", "/api/workbench/files", {
      headers: { "Idempotency-Key": randomUUID() },
      contentType: `multipart/form-data; boundary=${boundary}`,
      rawBody: Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="figure.png"\r\nContent-Type: image/png\r\n\r\n`),
        png,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]),
    });
    assert.equal(upload.status, 201, upload.text);
    const input = question("用于备课的原题");
    input.body.blocks.push({ type: "image", fileId: upload.json.id, alt: "原题配图", widthMm: 60 });
    const q = await call("POST", Q, input, 201);
    const copy = await call("POST", `${Q}/${q.id}/copies`, { ...writable(q), title: "独立改编题", baseVersion: q.version }, 201);
    const resourceRoot = "/api/modules/resources/items";
    const resource = await call("POST", resourceRoot, {
      title: "插图资源", fileId: upload.json.id, folderId: null, tagIds: [], note: "",
    }, 201);
    const mathRoot = "/api/modules/math/v1/works";
    const math = await call("POST", mathRoot, {
      title: "新版本数学作品", source: { ...emptySource("formula"), latex: "x^2" }, originalFileId: null,
    }, 201);
    const materials = [
      { id: randomUUID(), kind: "question", questionId: q.id, questionVersion: q.version, note: "" },
      { id: randomUUID(), kind: "resource", resourceId: resource.id, resourceVersion: resource.version, note: "" },
      { id: randomUUID(), kind: "math", workId: math.id, workVersion: math.version, note: "" },
    ];
    const original = await call("POST", lessons, { title: "采用材料的备课", intro: doc("第一稿"), sections: [], materials }, 201);
    const saved = await call("PUT", `${lessons}/${original.id}`, {
      baseVersion: original.version, title: original.title, intro: doc("第二稿"), sections: [], materials,
    });
    for (const [root, item] of [[Q, q], [resourceRoot, resource], [mathRoot, math]]) {
      const archived = await call("POST", `${root}/${item.id}/deletion`, { baseVersion: item.version, deleted: true });
      await call("POST", `${root}/${item.id}/purge`, { baseVersion: archived.version });
    }
    const retained = await call("GET", `${lessons}/${original.id}`);
    assert.deepEqual(retained.materials.map(r => r.snapshot), original.materials.map(r => r.snapshot));
    assert(retained.materials.every(r => r.sourceState === "deleted"));
    assert.deepEqual((await call("GET", `${Q}/${copy.id}`)).source.snapshot, copy.source.snapshot);
    return { directory, world, client, call, accountKey: session.account.accountKey, original, saved, retained, copy, fileId: upload.json.id };
  } catch (error) {
    await world.close();
    throw error;
  }
}

test("real-auth personal export keeps adopted materials and copied questions after source purge", async () => {
  const state = await prepare();
  let passed = false;
  try {
    const accepted = await state.call("POST", "/api/reliability/v1/exports", {}, 202);
    let result;
    for (let n = 0; n < 200; n++) {
      result = await state.call("GET", `/api/reliability/v1/exports/${accepted.id}`);
      if (!["queued", "running"].includes(result.state)) break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(result.state, "ready", JSON.stringify(result));
    const zip = await JSZip.loadAsync(fs.readFileSync(path.join(state.directory, "personal-exports", `${result.id}.zip`)));
    const manifest = JSON.parse(await zip.file("manifest.json").async("string"));
    const lesson = manifest.objects.find(o => o.key.kind === "lesson" && o.key.id === state.original.id);
    const exported = JSON.parse(await zip.file(lesson.dataPath).async("string"));
    assert.deepEqual(exported.value.materials.map(r => r.snapshot), state.original.materials.map(r => r.snapshot));
    assert(manifest.objects.some(o => o.key.kind === "question" && o.key.id === state.copy.id));
    assert(manifest.objects.some(o => o.key.kind === "file" && o.key.id === state.fileId));
    assert(manifest.relations.every(r => manifest.objects.some(o => JSON.stringify(o.key) === JSON.stringify(r.to))));
    passed = true;
  } finally {
    await state.world.close();
    if (passed) fs.rmSync(state.directory, { recursive: true, force: true });
  }
});

test("same-version backup restores lesson history and v5 snapshots after source purge", async () => {
  const state = await prepare();
  const target = `${state.directory}-backup`, restored = `${state.directory}-restored`;
  let world = state.world, passed = false;
  try {
    await world.close(); world = null;
    assert.equal((await backup({ database: path.join(state.directory, "workspace.sqlite"), files: path.join(state.directory, "files"), target, stopped: true })).state, "backed-up");
    assert.equal(restore({ source: target, target: restored, stopped: true }).state, "prepared");
    assert.equal(activate({ target: restored, stopped: true }).state, "activated");
    world = await createIntegration({ directory: restored });
    const client = world.client(), call = http(client);
    await client.request("POST", "/api/auth/session", { body: { action: "bootstrap" } });
    const login = await call("POST", "/api/auth/login", { email, password: "math-password", rememberMe: true });
    await call("POST", "/api/auth/session", { action: "activate", sessionId: login.id, rememberMe: true });
    assert.deepEqual(await call("GET", `${lessons}/${state.original.id}`), state.retained);
    const recovered = await call("POST", `${lessons}/${state.original.id}/history/restore`, { baseVersion: state.saved.version, version: state.original.version });
    assert.deepEqual(recovered.intro, state.original.intro);
    assert.deepEqual(recovered.materials.map(r => r.snapshot), state.original.materials.map(r => r.snapshot));
    assert.deepEqual((await call("GET", `${Q}/${state.copy.id}`)).source.snapshot, state.copy.source.snapshot);
    assert.equal((await client.request("GET", `/api/workbench/files/${state.fileId}/content`)).status, 200);
    passed = true;
  } finally {
    await world?.close();
    if (passed) for (const directory of [state.directory, target, restored]) fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("snapshot backup rejects foreign sources and invalid history ownership, content or files", async () => {
  const state = await prepare();
  let db, passed = false;
  try {
    const other = await registerMath(state.world, "another-owner@example.test");
    const foreign = await http(other.client)("POST", Q, question("另一账户的原题"), 201);
    await state.world.close();
    db = new Database(path.join(state.directory, "workspace.sqlite"));
    const history = db.prepare("SELECT * FROM lesson_history WHERE lessonId=? AND version=?").get(state.original.id, state.original.version);
    const reference = db.prepare("SELECT * FROM lesson_references WHERE lessonId=? AND kind='question'").get(state.original.id);
    const scenarios = [
      ["foreign adopted source", () => db.prepare("UPDATE lesson_references SET questionId=? WHERE referenceId=?").run(foreign.id, reference.referenceId),
        () => db.prepare("UPDATE lesson_references SET questionId=? WHERE referenceId=?").run(reference.questionId, reference.referenceId), /foreign object reference/],
      ["foreign copy source", () => db.prepare("UPDATE question_items SET sourceQuestionId=? WHERE id=?").run(foreign.id, state.copy.id),
        () => db.prepare("UPDATE question_items SET sourceQuestionId=? WHERE id=?").run(state.copy.source.questionId, state.copy.id), /foreign object reference/],
    ];
    for (const [name, mutate, expected] of [
      ["history owner", snapshot => { snapshot.record.accountKey = other.session.account.accountKey; }, /Broken lesson history snapshot/],
      ["history source", snapshot => { snapshot.references[0].questionId = foreign.id; }, /foreign object reference/],
      ["history file", snapshot => { snapshot.record.intro.blocks.push({ type: "image", fileId: randomUUID(), alt: "缺失文件", widthMm: 60 }); }, /file reference/],
      ["history content", snapshot => { snapshot.record.intro.version = 999; }, error => error.status === 422],
    ]) {
      const snapshot = JSON.parse(history.snapshot);
      mutate(snapshot);
      const update = value => db.prepare("UPDATE lesson_history SET snapshot=? WHERE lessonId=? AND version=?").run(value, history.lessonId, history.version);
      scenarios.push([name, () => update(JSON.stringify(snapshot)), () => update(history.snapshot), expected]);
    }
    for (const [name, mutate, reset, expected] of scenarios) {
      mutate();
      try {
        await assert.rejects(backup({ database: path.join(state.directory, "workspace.sqlite"), files: path.join(state.directory, "files"), target: `${state.directory}-rejected-${randomUUID()}`, stopped: true }), expected, name);
      } finally {
        reset();
      }
    }
    passed = true;
  } finally {
    db?.close();
    await state.world.close();
    if (passed) fs.rmSync(state.directory, { recursive: true, force: true });
  }
});
