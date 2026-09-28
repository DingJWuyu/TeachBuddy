import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, randomBytes } from "node:crypto";
import sharp from "sharp";
import Database from "better-sqlite3";
import JSZip from "jszip";
import { createIntegration } from "./fixtures/auth-integration/harness.js";
import { manualQuestionSample, lessonSample } from "./first-flow-harness.js";
import {
  backup,
  restore,
  activate,
} from "../src/workbench/reliability/backup.js";
import { sha256 } from "../src/workbench/reliability/storage.js";
const root = fileURLToPath(new URL("../../../test-results/reliability-api/", import.meta.url));
fs.mkdirSync(root, { recursive: true });
async function account(world, email = "data@example.test") {
  const client = world.client();
  await client.request("POST", "/api/auth/session", {
    body: { action: "bootstrap" },
  });
  const code = await client.request("POST", "/api/auth/registration-codes", {
    body: { email },
  });
  const registered = await client.request("POST", "/api/auth/register", {
    body: {
      email,
      nickname: "资料老师",
      password: "Manual-data-123",
      termsAccepted: true,
      rememberMe: true,
      challengeId: code.json.challengeId,
      verificationCode: world.mailer.lastCode("registration", email),
    },
  });
  assert.equal(registered.status, 201, registered.text);
  assert.equal(
    (
      await client.request("POST", "/api/auth/session", {
        body: {
          action: "activate",
          sessionId: registered.json.id,
          rememberMe: true,
        },
      })
    ).status,
    200,
  );
  return { client, accountKey: registered.json.account.accountKey };
}
const write = (client, url, body, key = randomUUID()) =>
  client.request("POST", url, { body, headers: { "Idempotency-Key": key } });

test("account appearance persists, isolates accounts, validates avatars and preserves legacy preferences", async () => {
  const directory = fs.mkdtempSync(path.join(root, "appearance-"));
  const world = await createIntegration({ directory });
  try {
    const a = await account(world), b = await account(world, "other@example.test");
    const url = "/api/reliability/v1/preferences";
    const initial = (await a.client.request("GET", url)).json;
    assert.equal(initial.values.theme, "light");
    const bytes = await sharp(randomBytes(256 * 256 * 3), { raw: { width: 256, height: 256, channels: 3 } }).webp({ quality: 90 }).toBuffer();
    const avatar = `data:image/webp;base64,${bytes.toString("base64")}`;
    assert(avatar.length > 16384);
    const body = { baseVersion: initial.version, values: { ...initial.values, theme: "dark", background: "stripes", avatar, locale: "en" } };
    const key = randomUUID();
    const put = (body, requestKey = randomUUID()) => a.client.request("PUT", url, { body, headers: { "Idempotency-Key": requestKey } });
    const saved = await put(body, key);
    assert.equal(saved.status, 200, saved.text);
    assert.deepEqual((await put(body, key)).json, saved.json);
    assert.equal((await a.client.request("GET", url)).json.values.avatar, avatar);
    assert.equal((await b.client.request("GET", url)).json.values.avatar, "");
    assert.equal((await b.client.request("GET", url)).json.values.theme, "light");
    assert.equal((await put(body)).status, 409);
    for (const invalid of [{ locale: "fr" }, { theme: "unknown" }, { background: "unknown" }, { avatar: "data:image/svg+xml,<svg/>" }, { avatar: "data:image/webp;base64,AAAA" }]) {
      const result = await put({ baseVersion: saved.json.version, values: { ...saved.json.values, ...invalid } });
      assert(result.status >= 400 && result.status < 500, result.text);
      assert.equal((await a.client.request("GET", url)).json.version, saved.json.version);
    }
    const legacy = await put({ baseVersion: saved.json.version, values: { readingSize: "large", motion: "system", externalAi: "deepseek" } });
    assert.equal(legacy.status, 200, legacy.text);
    assert.equal(legacy.json.values.theme, "dark");
    assert.equal(legacy.json.values.locale, "en");
    assert.equal(legacy.json.values.avatar, avatar);
    const removed = await put({ baseVersion: legacy.json.version, values: { ...legacy.json.values, avatar: "" } });
    assert.equal(removed.status, 200, removed.text);
    assert.equal((await a.client.request("GET", url)).json.values.avatar, "");
    world.workbench.db.prepare("UPDATE reliability_preferences SET valuesJson=? WHERE accountKey=?")
      .run(JSON.stringify({ readingSize: "large", motion: "reduce", externalAi: "deepseek" }), a.accountKey);
    const upgraded = (await a.client.request("GET", url)).json.values;
    assert.equal(upgraded.theme, "light");
    assert.equal(upgraded.background, "grid");
    assert.equal(upgraded.readingSize, "large");
  } finally {
    await world.close();
  }
});
async function untilReady(client, id) {
  for (let i = 0; i < 200; i++) {
    const r = await client.request("GET", `/api/reliability/v1/exports/${id}`);
    if (!["queued", "running"].includes(r.json.state)) return r.json;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("Export timed out");
}
test("real auth export snapshot, secrets exclusion, all files, idempotency and ownership", async () => {
  const directory = fs.mkdtempSync(path.join(root, "export-"));
  const world = await createIntegration({ directory });
  try {
    const a = await account(world),
      b = await account(world, "other@example.test");
    const q = await write(
      a.client,
      "/api/modules/questions/items",
      manualQuestionSample(),
    );
    assert.equal(q.status, 201, q.text);
    const deleted = await write(
      a.client,
      `/api/modules/questions/items/${q.json.id}/deletion`,
      { baseVersion: 1, deleted: true },
    );
    assert.equal(deleted.status, 200, deleted.text);
    const contents = Buffer.from("原文件保留 <script> 文本");
    const uploaded = await world.workbench.files.store(
      { accountKey: a.accountKey },
      { name: "原文.txt", bytes: contents },
      { key: randomUUID(), method: "POST", path: "/api/workbench/files" },
    );
    const conversation = world.workbench.agent.store.create(a.accountKey);
    world.workbench.agent.store.update(
      a.accountKey,
      conversation.conversation.id,
      (d) => {
        d.entries = [{ secret: "RAW-RUNTIME-SECRET" }];
        d.snapshot.draft.text = "老师原文 AUTH_CODE_SECRET 不应被删词";
      },
    );
    const rawBefore = world.workbench.db
      .prepare("SELECT document FROM agent_conversations")
      .get().document;
    const key = randomUUID(),
      accepted = await write(a.client, "/api/reliability/v1/exports", {}, key);
    assert.equal(accepted.status, 202, accepted.text);
    const replay = await write(
      a.client,
      "/api/reliability/v1/exports",
      {},
      key,
    );
    assert.deepEqual(replay.json, accepted.json);
    const ready = await untilReady(a.client, accepted.json.id);
    assert.equal(ready.state, "ready", JSON.stringify(ready));
    assert.equal(
      (await b.client.request("GET", ready.downloadPath)).status,
      404,
    );
    assert.equal(
      (await a.client.request("GET", ready.downloadPath, { cookie: null }))
        .status,
      401,
    );
    assert.equal(
      (await a.client.request("GET", ready.downloadPath)).status,
      200,
    );
    const zip = await JSZip.loadAsync(
      fs.readFileSync(
        path.join(directory, "personal-exports", `${ready.id}.zip`),
      ),
    );
    const manifest = JSON.parse(
      await zip.file("manifest.json").async("string"),
    );
    assert.equal(manifest.kind, "teachbuddy-personal");
    assert(
      manifest.objects.some(
        (o) => o.key.id === q.json.id && o.state === "deleted",
      ),
    );
    for (const entry of manifest.files) {
      const bytes = await zip.file(entry.path).async("nodebuffer");
      assert.equal(bytes.length, entry.bytes);
      assert.equal(sha256(bytes), entry.sha256);
    }
    const all = (
      await Promise.all(
        Object.values(zip.files)
          .filter((f) => !f.dir && !f.name.startsWith("files/"))
          .map((f) => f.async("string")),
      )
    ).join("\n");
    assert(!all.includes("RAW-RUNTIME-SECRET"));
    assert(!all.includes("passwordHash"));
    assert(all.includes("老师原文 AUTH_CODE_SECRET 不应被删词"));
    assert.equal(
      world.workbench.db
        .prepare("SELECT document FROM agent_conversations")
        .get().document,
      rawBefore,
    );
    assert.equal((await a.client.request("GET", "/api/reliability/v1/deleted")).status, 404);
    assert.equal(
      (
        await write(a.client, `/api/modules/questions/items/${q.json.id}/deletion`, {
          baseVersion: deleted.json.version,
          deleted: false,
        })
      ).status,
      200,
    );
    assert.equal(
      (await a.client.request("GET", `/api/modules/questions/items/${q.json.id}`)).json.deletedAt,
      null,
    );
  } finally {
    await world?.close();
  }
});
test("offline backup lock, isolated restore, persistent auth cleanup, activation and source preservation", async () => {
  const directory = fs.mkdtempSync(path.join(root, "backup-source-"));
  let world = await createIntegration({ directory });
  const a = await account(world);
  const oldCookie = a.client.jar.header(),
    oldPage = a.client.pageId;
  const q = await write(
    a.client,
    "/api/modules/questions/items",
    manualQuestionSample(),
  );
  assert.equal(q.status, 201, q.text);
  await world.workbench.files.store(
    { accountKey: a.accountKey },
    { name: "original.txt", bytes: Buffer.from("backup original") },
    { key: randomUUID(), method: "POST", path: "/api/workbench/files" },
  );
  const conversation = world.workbench.agent.store.create(a.accountKey);
  const operationId = randomUUID();
  const native = JSON.parse(
    world.workbench.db
      .prepare("SELECT document FROM agent_conversations WHERE id=?")
      .get(conversation.conversation.id).document,
  );
  native.snapshot.operations.push({ id: operationId, state: "unconfirmed" });
  native.entries.push({ opaqueVersion: 47, raw: "原字节保留" });
  const nativeBytes = JSON.stringify(native, null, 2);
  world.workbench.db
    .prepare("UPDATE agent_conversations SET document=? WHERE id=?")
    .run(nativeBytes, conversation.conversation.id);
  const oldContext = (
    await a.client.request("GET", "/api/reliability/v1/context")
  ).json;
  const target = path.join(root, `backup-${randomUUID()}`),
    restored = path.join(root, `restored-${randomUUID()}`);
  await assert.rejects(
    backup({
      database: path.join(directory, "workspace.sqlite"),
      files: path.join(directory, "files"),
      target,
      stopped: true,
    }),
    /in use/,
  );
  await world.close();
  world = null;
  const sourceHash = sha256(
    fs.readFileSync(path.join(directory, "workspace.sqlite")),
  );
  const result = await backup({
    database: path.join(directory, "workspace.sqlite"),
    files: path.join(directory, "files"),
    target,
    stopped: true,
  });
  assert.equal(result.state, "backed-up");
  const backupHash = sha256(
    fs.readFileSync(path.join(target, "workspace.sqlite")),
  );
  const receipt = restore({ source: target, target: restored, stopped: true });
  assert.equal(receipt.state, "prepared");
  assert.notEqual(receipt.recoveryId, oldContext.recoveryId);
  assert(Object.values(receipt.auth.first.removed).some((n) => n > 0));
  assert(Object.values(receipt.auth.second.removed).every((n) => n === 0));
  await assert.rejects(
    createIntegration({ directory: restored }),
    /explicit activation/,
  );
  assert.equal(
    activate({ target: restored, stopped: true }).state,
    "activated",
  );
  world = await createIntegration({ directory: restored });
  try {
    const client = world.client();
    assert.equal(
      (
        await client.request("GET", "/api/workbench/context", {
          cookie: oldCookie,
          page: oldPage,
        })
      ).status,
      401,
    );
    await client.request("POST", "/api/auth/session", {
      body: { action: "bootstrap" },
    });
    const login = await client.request("POST", "/api/auth/login", {
      body: {
        email: "data@example.test",
        password: "Manual-data-123",
        rememberMe: true,
      },
    });
    assert.equal(login.status, 200, login.text);
    assert.equal(
      (
        await client.request("POST", "/api/auth/session", {
          body: {
            action: "activate",
            sessionId: login.json.id,
            rememberMe: true,
          },
        })
      ).status,
      200,
    );
    assert.equal(
      (await client.request("GET", `/api/modules/questions/items/${q.json.id}`))
        .json.id,
      q.json.id,
    );
    assert.equal(
      (await client.request("GET", "/api/workbench/context")).json.accountKey,
      a.accountKey,
    );
    assert.equal(
      world.workbench.db
        .prepare("SELECT document FROM agent_conversations WHERE id=?")
        .get(conversation.conversation.id).document,
      nativeBytes,
    );
    const guarded = await write(
      client,
      `/api/agent/conversations/${conversation.conversation.id}/operations/${operationId}/reconcile`,
      {},
    );
    assert.equal(guarded.status, 409, guarded.text);
    assert.equal(
      guarded.json.type,
      "/problems/reliability/recovery-review-required",
    );
    const cookie = client.jar.header(),
      pageId = client.pageId;
    await world.close();
    world = await createIntegration({ directory: restored });
    assert.equal(
      (
        await world
          .client()
          .request("GET", "/api/workbench/context", { cookie, page: pageId })
      ).status,
      200,
    );
    assert.equal(
      sha256(fs.readFileSync(path.join(directory, "workspace.sqlite"))),
      sourceHash,
    );
    assert.equal(
      sha256(fs.readFileSync(path.join(target, "workspace.sqlite"))),
      backupHash,
    );
  } finally {
    await world.close();
  }
  const damaged = path.join(root, `damaged-${randomUUID()}`);
  fs.cpSync(target, damaged, { recursive: true });
  fs.appendFileSync(path.join(damaged, "workspace.sqlite"), "bad");
  assert.throws(
    () =>
      restore({
        source: damaged,
        target: path.join(root, `reject-${randomUUID()}`),
        stopped: true,
      }),
    /checksum/,
  );
});

test("all eight deletion kinds restore through original endpoints, class/record independence and saved relations", async () => {
  const directory = fs.mkdtempSync(path.join(root, "deleted-"));
  let world = await createIntegration({ directory });
  try {
    const a = await account(world);
    const make = async (url, body) => {
      const r = await write(a.client, url, body);
      assert([200, 201, 202].includes(r.status), r.text);
      return r.json;
    };
    const q = await make(
      "/api/modules/questions/items",
      manualQuestionSample(),
    );
    const l = await make("/api/modules/lessons/items", lessonSample());
    const f = await world.workbench.files.store(
      { accountKey: a.accountKey },
      { name: "original.txt", bytes: Buffer.from("保留文件") },
      { key: randomUUID(), method: "POST", path: "/api/workbench/files" },
    );
    const r = await make("/api/modules/resources/items", {
      title: "资源",
      fileId: f.id,
      folderId: null,
      tagIds: [],
      note: "",
    });
    const { emptySource } =
      await import("../../web/src/features/math/model.js");
    const m = await make("/api/modules/math/v1/works", {
      title: "公式",
      source: { ...emptySource("formula"), latex: "x^2" },
      originalFileId: null,
    });
    const lessonUpdate = await a.client.request(
      "PUT",
      `/api/modules/lessons/v3/${l.id}`,
      {
        body: {
          ...lessonSample(),
          baseVersion: 1,
          materials: [
            {
              id: randomUUID(),
              kind: "question",
              questionId: q.id,
              questionVersion: 1,
              note: "采用原题快照",
            },
            {
              id: randomUUID(),
              kind: "math",
              workId: m.id,
              workVersion: 1,
              note: "采用公式快照",
            },
          ],
        },
        headers: { "Idempotency-Key": randomUUID() },
      },
    );
    assert.equal(lessonUpdate.status, 200, lessonUpdate.text);
    const c = await make("/api/modules/classes/items", { name: "班级" });
    const record = await make("/api/modules/classes/v2/records", {
      classId: c.id,
      recordedOn: "2026-09-23",
      note: "记录",
      position: "",
      unfinished: "",
      commonIssues: "",
      nextNote: "",
      sources: [
        { kind: "question", id: q.id },
        { kind: "math", id: m.id },
      ],
    });
    const e = await make("/api/modules/schedule/entries", {
      title: "日程",
      items: [],
      time: null,
      repeat: null,
      course: { classId: c.id, lessonId: l.id, recordIds: [] },
      reminder: null,
    });
    const i = await make("/api/modules/questions/v2/imports", {
      title: "收录",
      origin: "",
      input: { kind: "text", text: "求 x²=4 的解" },
    });
    const items = [
      ["question", "/api/modules/questions/v2/items", q],
      ["lesson", "/api/modules/lessons/v3", l],
      ["resource", "/api/modules/resources/items", r],
      ["math", "/api/modules/math/v1/works", m],
      ["record", "/api/modules/classes/v2/records", record],
      ["class", "/api/modules/classes/items", c],
      ["entry", "/api/modules/schedule/entries", e],
      ["import", "/api/modules/questions/v2/imports", i],
    ];
    // Extraction fixture has no provider; allow it to settle before import deletion.
    for (let n = 0; n < 100; n++) {
      const j = await a.client.request("GET", `/api/workbench/jobs/${i.jobId}`);
      if (!["queued", "running", "cancelling"].includes(j.json.state)) break;
      await new Promise((r) => setTimeout(r, 10));
    }
    for (const [kind, base, value] of items) {
      const latest = await a.client.request("GET", `${base}/${value.id}`);
      const field = ["record", "class", "entry"].includes(kind)
        ? "expectedVersion"
        : "baseVersion";
      await make(`${base}/${value.id}/deletion`, {
        [field]: latest.json.version,
        deleted: true,
      });
    }
    const exported = await make("/api/reliability/v1/exports", {});
    assert.equal((await untilReady(a.client, exported.id)).state, "ready");
    for (const [kind, base, value] of [...items].sort(
      (a, b) => Number(b[0] === "class") - Number(a[0] === "class"),
    )) {
      const deleted = await a.client.request("GET", `${base}/${value.id}`);
      assert(deleted.json.deletedAt);
      const field = ["record", "class", "entry"].includes(kind) ? "expectedVersion" : "baseVersion";
      await make(`${base}/${value.id}/deletion`, {
        [field]: deleted.json.version,
        deleted: false,
      });
      assert.equal((await a.client.request("GET", `${base}/${value.id}`)).json.deletedAt, null);
    }
    const reopened = await a.client.request(
      "GET",
      `/api/modules/classes/v2/records/${record.id}`,
    );
    assert.equal(reopened.json.sources.length, 2);
    assert.equal(reopened.json.classId, c.id);
    const zip = await JSZip.loadAsync(
      fs.readFileSync(
        path.join(directory, "personal-exports", `${exported.id}.zip`),
      ),
    );
    const manifest = JSON.parse(
      await zip.file("manifest.json").async("string"),
    );
    for (const [kind, , value] of items)
      assert(
        manifest.objects.some(
          (o) =>
            o.key.kind === kind &&
            o.key.id === value.id &&
            o.state === "deleted",
        ),
        kind,
      );
    assert(manifest.relations.some((r) => r.relation === "class-record"));
    assert(
      manifest.relations.some(
        (r) => r.relation === "reference-snapshot" && r.to.id === m.id,
      ),
    );
    const preservedTables = [
      "question_items",
      "questions_materials_imports",
      "lesson_items",
      "lesson_sections",
      "lesson_references",
      "resource_items",
      "math_works",
      "math_revisions",
      "classes_items",
      "classes_records",
      "classes_record_sources",
      "schedule_entries",
      "schedule_exceptions",
      "materials_files",
    ];
    const before = Object.fromEntries(
      preservedTables.map((table) => [
        table,
        world.workbench.db
          .prepare(`SELECT * FROM ${table} ORDER BY rowid`)
          .all(),
      ]),
    );
    await world.close();
    world = null;
    await backup({
      database: path.join(directory, "workspace.sqlite"),
      files: path.join(directory, "files"),
      target: directory + "-backup",
      stopped: true,
    });
    restore({
      source: directory + "-backup",
      target: directory + "-restored",
      stopped: true,
    });
    const restoredDb = new Database(
      path.join(directory + "-restored", "workspace.sqlite"),
      { fileMustExist: true },
    );
    try {
      for (const table of preservedTables)
        assert.deepEqual(
          restoredDb.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(),
          before[table],
          table,
        );
    } finally {
      restoredDb.close();
    }
    activate({ target: directory + "-restored", stopped: true });
    world = await createIntegration({ directory: directory + "-restored" });
  } finally {
    await world?.close();
  }
});

test("CLI executes legacy manual backup upgrade; missing files, tampering and unknown migrations fail closed", async () => {
  const directory = fs.mkdtempSync(path.join(root, "cli-"));
  let world = await createIntegration({ directory });
  const a = await account(world);
  const file = await world.workbench.files.store(
    { accountKey: a.accountKey },
    { name: "完整原件 #1.txt", bytes: Buffer.from("原件") },
    { key: randomUUID(), method: "POST", path: "/api/workbench/files" },
  );
  // A missing managed file must produce a visible failed export, never a ready ZIP.
  const row = world.workbench.db
      .prepare("SELECT * FROM materials_files WHERE id=?")
      .get(file.id),
    blobPath = path.join(directory, "files", "blobs", row.blobName),
    bytes = fs.readFileSync(blobPath);
  fs.unlinkSync(blobPath);
  const accepted = await write(a.client, "/api/reliability/v1/exports", {});
  assert.equal(accepted.status, 202, accepted.text);
  const failed = await untilReady(a.client, accepted.json.id);
  assert.equal(failed.state, "failed");
  const noDownload = await a.client.request(
    "GET",
    `/api/reliability/v1/exports/${failed.id}/content`,
  );
  assert.equal(noDownload.status, 409, noDownload.text);
  fs.writeFileSync(blobPath, bytes);
  await world.close();
  world = null;
  const db = new Database(path.join(directory, "workspace.sqlite"), {
    fileMustExist: true,
  });
  db.exec(
    "DROP TABLE reliability_frozen_operations; DROP TABLE reliability_exports; DROP TABLE reliability_context; DELETE FROM workbench_migrations WHERE moduleId='reliability'",
  );
  db.close();
  const { spawnSync } = await import("node:child_process");
  const sourceDatabase=path.join(directory,'workspace.sqlite');
  const walWriter=spawnSync(process.execPath,['--input-type=module','-e',`import Database from 'better-sqlite3';const db=new Database(process.argv[1]);db.pragma('journal_mode=WAL');db.prepare('UPDATE auth_accounts SET nickname=?').run('WAL备份教师');process.kill(process.pid,'SIGKILL');`,sourceDatabase],{encoding:'utf8'});
  assert.equal(walWriter.signal,'SIGKILL');
  const originalMain=sha256(fs.readFileSync(sourceDatabase)),originalWal=sha256(fs.readFileSync(sourceDatabase+'-wal'));

  const command = (args) =>
    spawnSync(
      process.execPath,
      [fileURLToPath(new URL("../src/scripts/reliability.js", import.meta.url)), ...args],
      { encoding: "utf8", env: { ...process.env, TMPDIR: root } },
    );
  const backupPath = directory + "-backup",
    restoredPath = directory + "-restored";
  let output = command([
    "backup",
    "--database",
    path.join(directory, "workspace.sqlite"),
    "--files",
    path.join(directory, "files"),
    "--target",
    backupPath,
    "--stopped",
  ]);
  assert.equal(output.status, 0, output.stderr);
  assert.equal(JSON.parse(output.stdout).state, "backed-up");
  assert.equal(sha256(fs.readFileSync(sourceDatabase)),originalMain);
  assert.equal(sha256(fs.readFileSync(sourceDatabase+'-wal')),originalWal);
  const snapshotDb=new Database(path.join(backupPath,'workspace.sqlite'),{readonly:true});
  assert.equal(snapshotDb.prepare('SELECT nickname FROM auth_accounts').get().nickname,'WAL备份教师');snapshotDb.close();

  output = command([
    "restore",
    "--source",
    backupPath,
    "--target",
    restoredPath,
    "--stopped",
  ]);
  assert.equal(output.status, 0, output.stderr);
  assert.equal(JSON.parse(output.stdout).state, "prepared");
  output = command(["activate", "--target", restoredPath, "--stopped"]);
  assert.equal(output.status, 0, output.stderr);
  assert.equal(JSON.parse(output.stdout).state, "activated");
  world = await createIntegration({ directory: restoredPath });
  await world.close();
  world = null;
  const rejected = directory + "-unknown";
  fs.cpSync(backupPath, rejected, { recursive: true });
  const changed = new Database(path.join(rejected, "workspace.sqlite"));
  changed
    .prepare("INSERT INTO workbench_migrations VALUES (?,?,?)")
    .run("unknown_001", "unknown", new Date().toISOString());
  changed.close();
  const manifest = JSON.parse(
    fs.readFileSync(path.join(rejected, "manifest.json"), "utf8"),
  );
  const changedBytes = fs.readFileSync(path.join(rejected, "workspace.sqlite"));
  manifest.database.bytes = changedBytes.length;
  manifest.database.sha256 = sha256(changedBytes);
  fs.writeFileSync(
    path.join(rejected, "manifest.json"),
    JSON.stringify(manifest),
  );
  output = command([
    "restore",
    "--source",
    rejected,
    "--target",
    directory + "-rejected",
    "--stopped",
  ]);
  assert.notEqual(output.status, 0);
  assert.match(output.stderr, /Unsupported migration set/);
  assert(
    fs.existsSync(path.join(directory + "-rejected", "recovery-pending.json")),
  );
  assert(
    !fs.existsSync(
      path.join(directory + "-rejected", "recovery-prepared.json"),
    ),
  );
});
