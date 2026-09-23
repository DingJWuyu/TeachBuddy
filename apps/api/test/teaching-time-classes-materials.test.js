import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createIntegration } from "./fixtures/auth-integration/harness.js";
import { registerMath } from "../../web/e2e/fixtures/math-static/real.mjs";
import { ContractError } from "../src/workbench/problems.js";
import { createClassesModule } from "../src/modules/classes/index.js";
import {
  Q,
  R,
  C,
  doc,
  question,
  record,
  writable,
  http,
  seedRich,
  seedLegacy,
} from "./teaching-time-classes-materials-fixture.js";
const evidence = path.resolve(
  process.env.MTA_EVIDENCE ??
    "docs/acceptance/evidence/MATERIALS-TEACHING-ALIGNMENT/v1/implementation",
);
fs.mkdirSync(evidence, { recursive: true });
async function setup(t, name) {
  const world = await createIntegration();
  const trace = [];
  const { client } = await registerMath(world, `${name}@example.test`);
  t.after(async () => {
    await world.close();
    fs.writeFileSync(
      path.join(evidence, `${name}.json`),
      JSON.stringify(
        { directory: world.directory, identity: "real-auth", trace },
        null,
        2,
      ),
    );
  });
  return { world, client, call: http(client, trace) };
}
test("WB-MTA001/006/007: rich, imported, copied and mixed sources through public HTTP", async (t) => {
  const { world, client, call } = await setup(t, "http-rich");
  const { rich, v1, copy, imported } = await seedRich(client);
  const { client: other } = await registerMath(world, "foreign@example.test");
  const foreign = await http(other)("POST", Q, question(rich.title), 201);
  const listed = await call("GET", `${Q}?state=active`);
  assert.deepEqual(
    new Set(listed.items.map((x) => x.id)),
    new Set([rich.id, v1.id, copy.id, imported.id]),
  );
  assert.ok(
    !(
      await call("GET", `${Q}?q=${encodeURIComponent(rich.title)}&state=active`)
    ).items.some((x) => x.id === foreign.id),
  );
  const legacy = await seedLegacy(client);
  const input = record(legacy.classroom.id, [
    { kind: "question", id: rich.id },
    { kind: "lesson", id: legacy.lesson.id },
    { kind: "math", id: legacy.math.id },
  ]);
  const mixed = await call("POST", R, input, 201);
  assert.deepEqual(
    mixed.sources.map((s) => s.kind),
    ["question", "lesson", "math"],
  );
  assert.equal(mixed.sources[0].labelAtLink, rich.title);
  for (const source of mixed.sources) {
    const feedback = await call(
      "GET",
      `/api/modules/classes/v2/source-records/${source.kind}/${source.id}`,
    );
    assert.deepEqual(
      feedback.items.find((x) => x.id === mixed.id),
      mixed,
    );
  }
  for (const url of [
    "/api/modules/questions/items",
    `/api/modules/questions/items/${rich.id}`,
  ]) {
    const error = await call("GET", url, undefined, 422);
    assert.equal(error.reason, "unsupported-content-version");
  }
  assert.throws(
    () =>
      world.workbench.loader
        .get("questions")
        .port.readForReference({ accountKey: legacyAccount(world) }, rich.id),
    (e) => e.status === 422,
  );
  for (const [url, field] of [
    [`/api/modules/classes/records/${mixed.id}`, "/sources"],
    [`/api/modules/classes/records?classId=${legacy.classroom.id}`, "/items"],
    [`/api/modules/classes/source-records/question/${rich.id}`, "/items"],
  ]) {
    const error = await call("GET", url, undefined, 422);
    assert.equal(error.field, field);
    assert.equal(error.reason, "unsupported-content-version");
  }
  await call(
    "PUT",
    `/api/modules/classes/records/${mixed.id}`,
    { ...input, sources: [], expectedVersion: 0 },
    422,
  );
  const changed = await call("PUT", `${R}/${mixed.id}`, {
    ...input,
    expectedVersion: 1,
    note: "新版文字",
  });
  await call(
    "PUT",
    `/api/modules/classes/records/${mixed.id}`,
    { ...input, sources: [], expectedVersion: 1 },
    409,
  );
  await call(
    "PUT",
    `/api/modules/classes/records/${mixed.id}`,
    { ...input, sources: [], expectedVersion: 2 },
    422,
  );
  assert.deepEqual((await call("GET", `${Q}/${rich.id}`)).body, rich.body);
  const baseline = JSON.parse(
    execFileSync(
      "git",
      [
        "show",
        "2682475041aa187e3cd50ad743dc5e5bc243feda:docs/contracts/teaching-time/math-samples.json",
      ],
      { encoding: "utf8" },
    ),
  );
  const oldCatalog = baseline.samples.find(
    (x) => x.id === "catalog-combined-target",
  )?.value;
  if (!oldCatalog) throw Error("Frozen catalog sample missing");
  const expected = structuredClone(oldCatalog);
  expected.items.find((x) => x.id === "classes").requires[0] =
    "questions.readForReferenceV2";
  assert.deepEqual(await call("GET", "/api/modules"), expected);
  assert.throws(
    () =>
      createClassesModule({
        db: world.workbench.db,
        mutations: world.workbench.mutations,
        questions: { readForReference() {} },
        lessons: { readForTeachingLink() {} },
      }),
    /readForReferenceV2/,
  );
  assert.equal(changed.version, 2);
});
function legacyAccount(world) {
  return world.workbench.db
    .prepare("SELECT accountKey FROM auth_accounts ORDER BY rowid LIMIT 1")
    .get().accountKey;
}
test("WB-MTA002/004/005/007: transactions, tombstones, failures, replay and isolation", async (t) => {
  const { world, client, call } = await setup(t, "http-failure");
  const legacy = await seedLegacy(client);
  const q = await call("PUT", `${Q}/${legacy.item.id}`, {
    ...writable({
      ...question("丰富后的当前标题"),
      ...legacy.item,
      body: doc("丰富化正文"),
      solution: doc(""),
      title: "丰富后的当前标题",
      answerStatus: "absent",
      typeId: null,
      tagIds: [],
    }),
    baseVersion: 1,
  });
  const before = await call("GET", `${R}/${legacy.saved.id}`);
  assert.equal(before.version, 1);
  assert.equal(before.updatedAt, legacy.saved.updatedAt);
  assert.equal(before.sources[0].labelAtLink, "首次旧标题");
  assert.equal(before.sources[0].currentLabel, q.title);
  assert.deepEqual(
    await call("GET", `/api/modules/classes/records/${before.id}`),
    before,
  );
  assert.deepEqual(
    await call(
      "POST",
      "/api/modules/classes/records",
      legacy.body,
      201,
      legacy.key,
    ),
    legacy.saved,
  );
  await call("POST", R, legacy.body, 409, legacy.key);
  const port = world.workbench.loader.get("questions").port,
    original = port.readForReferenceV2;
  const principal = { accountKey: legacyAccount(world) };
  const count = () =>
    world.workbench.db
      .prepare("SELECT count(*) n FROM workbench_mutation_keys")
      .get().n;
  const rows = () =>
    JSON.stringify(
      world.workbench.db
        .prepare("SELECT * FROM classes_records ORDER BY id")
        .all(),
    ) +
    JSON.stringify(
      world.workbench.db
        .prepare(
          "SELECT * FROM classes_record_sources ORDER BY recordId,position",
        )
        .all(),
    );
  const key = randomUUID(),
    payload = { ...legacy.body, expectedVersion: 1, note: "恢复后只保存一次" };
  for (const status of [404, 503]) {
    port.readForReferenceV2 = () => {
      throw new ContractError(status, {
        type:
          status === 404
            ? "/problems/workbench/not-found"
            : "/problems/workbench/temporarily-unavailable",
      });
    };
    const stable = rows(),
      receipts = count();
    await call("GET", `${R}/${before.id}`, undefined, status);
    await call("GET", `${R}?classId=${before.classId}`, undefined, status);
    await call(
      "GET",
      `/api/modules/classes/v2/source-records/question/${q.id}`,
      undefined,
      status,
    );
    await call("PUT", `${R}/${before.id}`, payload, status, key);
    await call(
      "POST",
      `${R}/${before.id}/deletion`,
      { expectedVersion: 1, deleted: true },
      status,
    );
    await call(
      "POST",
      R,
      record(before.classId, [{ kind: "question", id: q.id }]),
      status,
    );
    assert.equal(rows(), stable);
    assert.equal(count(), receipts);
    assert.equal(
      world.workbench.loader
        .get("classes")
        .port.readRecord(principal, before.id).id,
      before.id,
    );
    assert.deepEqual(
      await call(
        "POST",
        "/api/modules/classes/records",
        legacy.body,
        201,
        legacy.key,
      ),
      legacy.saved,
    );
  }
  port.readForReferenceV2 = original;
  const saved = await call("PUT", `${R}/${before.id}`, payload, 200, key);
  assert.equal(saved.version, 2);
  assert.deepEqual(
    await call("PUT", `${R}/${before.id}`, payload, 200, key),
    saved,
  );
  await call("PUT", `${R}/${before.id}`, { ...payload, note: "过时编辑" }, 409);
  const deletedQuestion = await call("POST", `${Q}/${q.id}/deletion`, {
    baseVersion: 2,
    deleted: true,
  });
  assert.equal(
    (await call("GET", `${R}/${before.id}`)).sources[0].deleted,
    true,
  );
  await call("POST", R, legacy.body, 409);
  const retained = await call("PUT", `${R}/${before.id}`, {
    ...legacy.body,
    expectedVersion: 2,
    note: "来源删除仍可记录",
  });
  assert.equal(retained.version, 3);
  const deletedRecord = await call("POST", `${R}/${before.id}/deletion`, {
    expectedVersion: 3,
    deleted: true,
  });
  assert.equal(
    (
      await call(
        "GET",
        `/api/modules/classes/v2/source-records/question/${q.id}`,
      )
    ).items.length,
    0,
  );
  const restored = await call("POST", `${R}/${before.id}/deletion`, {
    expectedVersion: deletedRecord.version,
    deleted: false,
  });
  assert.equal(restored.version, 5);
  const removed = await call("PUT", `${R}/${before.id}`, {
    ...legacy.body,
    sources: [],
    expectedVersion: 5,
  });
  await call(
    "PUT",
    `${R}/${before.id}`,
    { ...legacy.body, expectedVersion: removed.version },
    409,
  );
  await call("POST", `${Q}/${q.id}/deletion`, {
    baseVersion: deletedQuestion.version,
    deleted: false,
  });
  const relinked = await call("PUT", `${R}/${before.id}`, {
    ...legacy.body,
    expectedVersion: removed.version,
  });
  assert.equal(relinked.sources[0].labelAtLink, q.title);
  const c = await call("POST", `${C}/${before.classId}/deletion`, {
    expectedVersion: 1,
    deleted: true,
  });
  assert.equal(
    (
      await call(
        "GET",
        `/api/modules/classes/v2/source-records/question/${q.id}`,
      )
    ).items.length,
    0,
  );
  await call("POST", `${C}/${before.classId}/deletion`, {
    expectedVersion: c.version,
    deleted: false,
  });
  assert.equal(
    (
      await call(
        "GET",
        `/api/modules/classes/v2/source-records/question/${q.id}`,
      )
    ).items.length,
    1,
  );
  const { client: other } = await registerMath(
    world,
    "other-failure@example.test",
  );
  await http(other)("GET", `${R}/${before.id}`, undefined, 404);
  await http(other)("GET", `${Q}/${q.id}`, undefined, 404);
  await http(other)(
    "GET",
    `/api/modules/classes/v2/source-records/question/${q.id}`,
    undefined,
    404,
  );
  await call("GET", `${R}/${before.id}`, undefined, 401, randomUUID(), {
    cookie: null,
  });
  assert.equal((await call("GET", `${Q}/${q.id}`)).body.version, 2);
});
