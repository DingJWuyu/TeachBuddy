import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import JSZip from "jszip";
import Database from "better-sqlite3";
import { createIntegration } from "./fixtures/auth-integration/harness.js";
import { registerMath } from "../../web/e2e/fixtures/math-static/real.mjs";
import { emptySource } from "../../web/src/features/math/model.js";
import { doc, question, http, writable, Q } from "./teaching-time-classes-materials-fixture.js";
import { backup, restore, activate } from "../src/workbench/reliability/backup.js";

const lessons = "/api/modules/lessons/v3";
const email = "snapshots@example.test";

async function prepare({ historyOnly = false } = {}) {
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
    const section = { id: randomUUID(), title: '旧环节 <script>alert("title")</script>',
      content: { version: 2, blocks: [
        ...doc("旧稿独有正文").blocks, { type: "math", latex: "y=\\frac{1}{x+3}" },
        { type: "image", fileId: upload.json.id, alt: "旧稿独有配图", widthMm: 60 },
        ...doc("材料之后的讲解").blocks,
      ] }, references: [
        { ...materials[0], id: randomUUID(), note: "历史讲解备注", afterBlock: 1 },
        { id: randomUUID(), kind: "question", questionId: copy.id, questionVersion: copy.version, note: "", afterBlock: null },
      ] };
    const original = await call("POST", lessons, { title: "采用材料的备课", intro: doc("第一稿"), sections: historyOnly ? [section] : [], materials }, 201);
    const saved = await call("PUT", `${lessons}/${original.id}`, {
      baseVersion: original.version, title: original.title, intro: doc("第二稿"), sections: [], materials: historyOnly ? [] : materials,
    });
    for (const [root, item] of [[Q, q], [resourceRoot, resource], [mathRoot, math]]) {
      const archived = await call("POST", `${root}/${item.id}/deletion`, { baseVersion: item.version, deleted: true });
      await call("POST", `${root}/${item.id}/purge`, { baseVersion: archived.version });
    }
    const retained = await call("GET", `${lessons}/${original.id}`);
    assert.deepEqual(retained.materials.map(r => r.snapshot), historyOnly ? [] : original.materials.map(r => r.snapshot));
    assert(retained.materials.every(r => r.sourceState === "deleted"));
    assert.deepEqual((await call("GET", `${Q}/${copy.id}`)).source.snapshot, copy.source.snapshot);
    return { directory, world, client, call, accountKey: session.account.accountKey, original, saved, retained, copy, fileId: upload.json.id, png };
  } catch (error) {
    await world.close();
    throw error;
  }
}

async function exportResult(state, accepted) {
  for (let n = 0; n < 200; n++) {
    const result = await state.call("GET", `/api/reliability/v1/exports/${accepted.id}`);
    if (!["queued", "running"].includes(result.state)) return result;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error("Personal export timed out");
}
async function archive(state, accepted) {
  accepted ??= await state.call("POST", "/api/reliability/v1/exports", {}, 202);
  const result = await exportResult(state, accepted);
  assert.equal(result.state, "ready", JSON.stringify(result));
  const zip = await JSZip.loadAsync(fs.readFileSync(path.join(state.directory, "personal-exports", `${result.id}.zip`)));
  const manifest = JSON.parse(await zip.file("manifest.json").async("string"));
  return { zip, manifest, result };
}

test("real-auth personal export keeps adopted materials and copied questions after source purge", async () => {
  const state = await prepare();
  let passed = false;
  try {
    const { zip, manifest } = await archive(state);
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

test("personal lesson history retains removed content, placements and files in one isolated export snapshot", async () => {
  const state = await prepare({ historyOnly: true });
  let passed = false;
  try {
    const other = await registerMath(state.world, "history-other@example.test");
    const foreign = await http(other.client)("POST", lessons, {
      title: "另一账户的课稿", intro: doc("另一账户私有正文"), sections: [], materials: [],
    }, 201);
    const expected = await state.call("GET", `${lessons}/${state.original.id}/history/1`);
    const accepted = await state.call("POST", "/api/reliability/v1/exports", {}, 202);
    await state.call("PUT", `${lessons}/${state.original.id}`, {
      baseVersion: state.saved.version, title: "导出受理后的第三稿", intro: doc("不应混入旧包"), sections: [], materials: [],
    });
    const { zip, manifest, result } = await archive(state, accepted);
    assert.equal((await other.client.request("GET", result.downloadPath)).status, 404);
    const revisions = manifest.objects.filter(o => o.key.kind === "lesson-revision");
    assert.deepEqual(revisions.map(o => o.key.version), [2, 1]);
    assert(revisions.every(o => o.key.id === state.original.id));
    assert(!manifest.objects.some(o => o.key.id === foreign.id));
    const old = revisions.find(o => o.key.version === 1);
    const data = JSON.parse(await zip.file(old.dataPath).async("string")).value;
    assert.deepEqual(data, { ...expected, savedAt: state.original.updatedAt });
    assert(!JSON.stringify(data).includes("accountKey"));
    const current = manifest.objects.find(o => o.key.kind === "lesson");
    assert.deepEqual(JSON.parse(await zip.file(current.dataPath).async("string")).value, state.saved);
    assert(manifest.relations.some(r => r.from.kind === "lesson-revision" && r.from.version === 1 && r.to.kind === "lesson" && r.relation === "current-link"));
    assert(manifest.relations.some(r => r.from.kind === "lesson-revision" && r.from.version === 1 && r.to.id === state.fileId));
    assert(manifest.relations.some(r => r.from.kind === "lesson-revision" && r.from.version === 1 && r.to.id === state.copy.id && r.relation === "reference-snapshot" && r.location === "sections/0/references/1"));
    assert(manifest.relations.every(r => manifest.objects.some(o => JSON.stringify(o.key) === JSON.stringify(r.to))));
    const html = await zip.file(old.readablePath).async("string");
    assert(html.includes("旧稿独有正文"));
    assert(html.includes("y=\\frac{1}{x+3}"));
    assert(html.indexOf("旧稿独有正文") < html.indexOf("历史讲解备注"));
    assert(html.indexOf("历史讲解备注") < html.indexOf("材料之后的讲解"));
    assert(!html.includes('<script>alert("title")</script>'));
    assert(html.includes("&lt;script&gt;"));
    const index = await zip.file("index.html").async("string");
    assert(index.includes(`版本 1 · 保存于 ${state.original.updatedAt}`));
    const attachment = manifest.files.find(f => f.path.startsWith(`files/${state.fileId}/`));
    assert.deepEqual(await zip.file(attachment.path).async("nodebuffer"), state.png);
    for (const entry of manifest.files) {
      const bytes = await zip.file(entry.path).async("nodebuffer");
      assert.equal(bytes.length, entry.bytes);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256);
    }
    for (const entry of Object.values(zip.files).filter(f => f.name.endsWith(".html"))) {
      const contents = await entry.async("string");
      assert(!contents.includes("另一账户私有正文"));
      for (const [, href] of contents.matchAll(/(?:href|src)="([^"]+)"/g)) {
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(entry.name), decodeURIComponent(href)));
        assert(zip.file(target), `${entry.name}: missing local link ${href}`);
      }
    }
    passed = true;
  } finally {
    await state.world.close();
    if (passed) fs.rmSync(state.directory, { recursive: true, force: true });
  }
});

test("personal lesson history follows the 50-version/current rule, archive and permanent deletion", async () => {
  const state = await prepare({ historyOnly: true });
  let passed = false;
  try {
    let current = state.saved;
    for (let n = 0; n < 51; n++) {
      current = await state.call("PUT", `${lessons}/${current.id}`, {
        baseVersion: current.version, title: `保存版本 ${n}`, intro: doc(`第 ${n} 次编辑`), sections: [], materials: [],
      });
    }
    current = await state.call("POST", `${lessons}/${current.id}/deletion`, { baseVersion: current.version, deleted: true });
    // Exercise the supported virtual-current rule without creating a history row on read.
    const db = state.world.workbench.db;
    db.prepare("DELETE FROM lesson_history WHERE lessonId=? AND version=?").run(current.id, current.version);
    const before = db.prepare("SELECT COUNT(*) AS count FROM lesson_history WHERE lessonId=?").get(current.id).count;
    const history = await state.call("GET", `${lessons}/${current.id}/history`);
    const { manifest } = await archive(state);
    const revisions = manifest.objects.filter(o => o.key.kind === "lesson-revision");
    assert.equal(revisions.length, 50);
    assert.equal(new Set(revisions.map(o => `${o.key.id}/${o.key.version}`)).size, 50);
    assert.deepEqual(revisions.map(o => o.key.version), history.items.map(r => r.version));
    assert.equal(revisions.find(o => o.key.version === current.version).state, "deleted");
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM lesson_history WHERE lessonId=?").get(current.id).count, before);
    await state.call("POST", `${lessons}/${current.id}/purge`, { baseVersion: current.version });
    const removed = await archive(state);
    assert(!removed.manifest.objects.some(o => ["lesson", "lesson-revision"].includes(o.key.kind) && o.key.id === current.id));
    passed = true;
  } finally {
    await state.world.close();
    if (passed) fs.rmSync(state.directory, { recursive: true, force: true });
  }
});

test("personal history export rejects missing bytes and foreign history-only attachments", async () => {
  const state = await prepare({ historyOnly: true });
  let passed = false;
  try {
    const db = state.world.workbench.db;
    const file = db.prepare("SELECT blobName FROM materials_files WHERE id=?").get(state.fileId);
    const blob = path.join(state.directory, "files", "blobs", file.blobName);
    const bytes = fs.readFileSync(blob);
    fs.unlinkSync(blob);
    let accepted = await state.call("POST", "/api/reliability/v1/exports", {}, 202);
    let failed = await exportResult(state, accepted);
    assert.equal(failed.state, "failed");
    assert.equal(failed.downloadPath, null);
    assert(!fs.existsSync(path.join(state.directory, "personal-exports", `${accepted.id}.zip`)));
    fs.writeFileSync(blob, bytes);
    const other = await registerMath(state.world, "foreign-history-file@example.test");
    const foreignFile = await state.world.workbench.files.store(
      { accountKey: other.session.account.accountKey }, { name: "foreign.png", bytes },
      { key: randomUUID(), method: "POST", path: "/api/workbench/files" },
    );
    const old = db.prepare("SELECT snapshot FROM lesson_history WHERE lessonId=? AND version=1").get(state.original.id);
    const snapshot = JSON.parse(old.snapshot);
    snapshot.sections[0].content.blocks[2].fileId = foreignFile.id;
    db.prepare("UPDATE lesson_history SET snapshot=? WHERE lessonId=? AND version=1").run(JSON.stringify(snapshot), state.original.id);
    accepted = await state.call("POST", "/api/reliability/v1/exports", {}, 202);
    failed = await exportResult(state, accepted);
    assert.equal(failed.state, "failed");
    assert.equal(failed.downloadPath, null);
    assert(!fs.existsSync(path.join(state.directory, "personal-exports", `${accepted.id}.zip`)));
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
