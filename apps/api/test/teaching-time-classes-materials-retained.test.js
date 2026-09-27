import { fileURLToPath } from 'node:url';
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import { createIntegration } from "./fixtures/auth-integration/harness.js";
import {
  Q,
  R,
  http,
  doc,
  writable,
} from "./teaching-time-classes-materials-fixture.js";
const fixed = "2682475041aa187e3cd50ad743dc5e5bc243feda";
const root = fileURLToPath(new URL("../../../", import.meta.url)),
  evidence = path.resolve(
    process.env.MTA_EVIDENCE ??
      path.join(root, "test-results/evidence/MATERIALS-TEACHING-ALIGNMENT/v1/implementation"),
  );
fs.mkdirSync(evidence, { recursive: true });
const hash = (value) => createHash("sha256").update(value).digest("hex");
function snapshot(directory, legacyColumns = false) {
  const db = new Database(path.join(directory, "workspace.sqlite"), {
    readonly: true,
  });
  try {
    return Object.fromEntries(
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE 'question%' OR name LIKE 'classes_%' OR name LIKE 'lesson_%' OR name LIKE 'math_%' OR name='materials_files' OR name='workbench_mutation_keys') ORDER BY name",
        )
        .all()
        .map(({ name }) => [
          name,
          hash(
            JSON.stringify(
              db.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all().map(row => {
                if (legacyColumns && name === 'classes_records') {
                  assert.equal(row.nextNoteHidden, 0);
                  assert.deepEqual(JSON.parse(row.content), { version: 2, blocks: [] });
                  const { nextNoteHidden, content, ...legacy } = row;
                  return legacy;
                }
                return row;
              }),
            ),
          ),
        ]),
    );
  } finally {
    db.close();
  }
}
function files(directory) {
  const folder = path.join(directory, "files");
  if (!fs.existsSync(folder)) return {};
  return Object.fromEntries(
    fs
      .readdirSync(folder, { recursive: true, withFileTypes: true })
      .filter((x) => x.isFile())
      // Each server owns a new maintenance lock; only persisted user files must stay identical.
      .filter((x) => !path.relative(folder, path.join(x.parentPath, x.name)).startsWith('.managed-files.maintenance-lock/'))
      .map((x) => {
        const p = path.join(x.parentPath, x.name);
        return [path.relative(folder, p), hash(fs.readFileSync(p))];
      }),
  );
}
test("WB-MTA002: immutable old candidate database, normal rich upgrade and two retained restarts", async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "mta-retained-")),
    old = path.join(folder, "fixed"),
    original = path.join(folder, "original"),
    candidate = path.join(folder, "candidate");
  fs.mkdirSync(old, { recursive: true });
  fs.mkdirSync(original);
  execFileSync("tar", ["-x", "-C", old], {
    input: execFileSync(
      "git",
      [
        "archive",
        fixed,
        "apps/api",
        "apps/web/e2e/fixtures/math-static/real.mjs",
        "packages/shared",
        "docs/contracts",
        "package.json",
      ],
      { cwd: root, maxBuffer: 40 * 1024 * 1024 },
    ),
  });
  fs.mkdirSync(path.join(old, "node_modules/@refatos"), { recursive: true });
  for (const name of fs.readdirSync(path.join(root, "node_modules")))
    if (name !== "@refatos")
      fs.symlinkSync(
        path.join(root, "node_modules", name),
        path.join(old, "node_modules", name),
      );
  fs.symlinkSync(
    path.join(old, "packages/shared"),
    path.join(old, "node_modules/@refatos/shared"),
  );
  fs.symlinkSync(
    path.join(root, "apps/api/node_modules"),
    path.join(old, "apps/api/node_modules"),
  );
  const fixture = new URL(
    "./teaching-time-classes-materials-fixture.js",
    import.meta.url,
  ).href;
  fs.writeFileSync(
    path.join(old, "seed.mjs"),
    `import fs from 'node:fs';import {createIntegration} from './apps/api/test/fixtures/auth-integration/harness.js';import {registerMath} from './apps/web/e2e/fixtures/math-static/real.mjs';import {seedLegacy} from ${JSON.stringify(fixture)};const w=await createIntegration({directory:${JSON.stringify(original)}});try {const {client}=await registerMath(w,'retained@example.test');fs.writeFileSync(${JSON.stringify(path.join(folder, "seed.json"))},JSON.stringify(await seedLegacy(client)));}finally{await w.close();}`,
  );
  execFileSync(process.execPath, [path.join(old, "seed.mjs")], { cwd: old });
  const seed = JSON.parse(fs.readFileSync(path.join(folder, "seed.json"))),
    oldRows = snapshot(original),
    oldFiles = files(original);
  fs.cpSync(original, candidate, { recursive: true });
  let world;
  const trace = [];
  async function start() {
    world = await createIntegration({ directory: candidate });
    const client = world.client();
    await client.request("POST", "/api/auth/session", {
      body: { action: "bootstrap" },
    });
    const login = await client.request("POST", "/api/auth/login", {
      body: {
        email: "retained@example.test",
        password: "math-password",
        rememberMe: true,
      },
    });
    assert.equal(login.status, 200);
    const active = await client.request("POST", "/api/auth/session", {
      body: { action: "activate", sessionId: login.json.id, rememberMe: true },
    });
    assert.equal(active.status, 200);
    return http(client, trace);
  }
  try {
    let call = await start();
    assert.deepEqual(snapshot(candidate, true), { ...oldRows, lesson_order: hash("[]"), classes_removed_objects: hash("[]") });
    assert.deepEqual(files(candidate), oldFiles);
    assert.deepEqual(await call("GET", `${R}/${seed.saved.id}`), { ...seed.saved, nextNoteHidden: false, content: { version: 2, blocks: [] } });
    assert.deepEqual(
      await call(
        "POST",
        "/api/modules/classes/records",
        seed.body,
        201,
        seed.key,
      ),
      seed.saved,
    );
    assert.deepEqual(snapshot(candidate, true), { ...oldRows, lesson_order: hash("[]"), classes_removed_objects: hash("[]") });
    const upgraded = await call("PUT", `${Q}/${seed.item.id}`, {
      ...writable({
        ...seed.item,
        answerStatus: "present",
        typeId: null,
        tagIds: [],
        title: "同 ID 丰富题",
        body: doc("正文升级"),
        solution: doc("答案保留"),
      }),
      baseVersion: 1,
    });
    const before = await call("GET", `${R}/${seed.saved.id}`);
    assert.equal(before.version, 1);
    assert.equal(before.updatedAt, seed.saved.updatedAt);
    assert.equal(before.sources[0].labelAtLink, "首次旧标题");
    assert.equal(before.sources[0].currentLabel, "同 ID 丰富题");
    const saved = await call("PUT", `${R}/${seed.saved.id}`, {
      ...seed.body,
      note: "显式改文字",
      expectedVersion: 1,
    });
    assert.equal(saved.version, 2);
    const deleted = await call("POST", `${R}/${saved.id}/deletion`, {
      expectedVersion: 2,
      deleted: true,
    });
    const restored = await call("POST", `${R}/${saved.id}/deletion`, {
      expectedVersion: deleted.version,
      deleted: false,
    });
    assert.equal(restored.version, 4);
    const stable = snapshot(candidate),
      fileState = files(candidate);
    for (let n = 0; n < 2; n++) {
      await world.close();
      world = null;
      call = await start();
      assert.deepEqual(await call("GET", `${Q}/${seed.item.id}`), upgraded);
      assert.deepEqual(await call("GET", `${R}/${saved.id}`), restored);
      assert.deepEqual(await call("GET", `${R}/${seed.mixed.id}`), { ...seed.mixed, nextNoteHidden: false, content: { version: 2, blocks: [] } });
      assert.deepEqual(
        await call("GET", `/api/modules/math/v1/works/${seed.math.id}`),
        seed.math,
      );
      assert.deepEqual(
        await call(
          "POST",
          "/api/modules/classes/records",
          seed.body,
          201,
          seed.key,
        ),
        seed.saved,
      );
      assert.deepEqual(
        await call("POST", R, seed.mathBody, 201, seed.mathKey),
        seed.mixed,
      );
      assert.deepEqual(snapshot(candidate), stable);
      assert.deepEqual(files(candidate), fileState);
    }
    assert.deepEqual(snapshot(original), oldRows);
    assert.deepEqual(files(original), oldFiles);
    fs.writeFileSync(
      path.join(evidence, "retained.json"),
      JSON.stringify(
        {
          fixed,
          folder,
          original,
          candidate,
          seed,
          oldRows,
          oldFiles,
          afterExplicitWrites: stable,
          readAndRestartUnchanged: true,
          trace,
        },
        null,
        2,
      ),
    );
  } finally {
    await world?.close();
  }
});
