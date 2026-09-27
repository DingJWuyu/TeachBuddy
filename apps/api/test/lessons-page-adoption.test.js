import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createEnv } from "../src/config/env.js";
import { createLessonsModule } from "../src/modules/lessons/index.js";
import { contractError, problems } from "../src/workbench/problems.js";

const base = "/api/modules/lessons/v3";
const doc = text => ({ version: 2, blocks: [{ type: "paragraph", runs: [{ type: "text", text }] }] });
const writable = lesson => ({ baseVersion: lesson.version, title: lesson.title, intro: lesson.intro,
  sections: lesson.sections.map(({ id, title, content, references }) => ({ id, title, content, references })), materials: [] });

// A frozen port fixture tests adoption transactions and failure recovery only.
// It neither runs OCR nor establishes recognition accuracy/product acceptance.
test("page adoption HTTP/SQLite: fixed supplement, snapshots, replay, conflicts and retained history", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lesson-page-adoption-"));
  const principal = { accountKey: "page-a" }, results = new Map();
  const recognition = { readResult(p, id, source) {
    const value = results.get(id);
    if (p.accountKey !== principal.accountKey || value?.state !== "ready" ||
        Object.entries(source).some(([key, value]) => results.get(id)?.location[key] !== value))
      throw contractError(problems.notFound());
    return structuredClone(value);
  } };
  const env = createEnv({ nodeEnv: "test", sqlitePath: path.join(dir, "db.sqlite"), workbench: {
    mode: "test-principal", testPrincipals: ["page-a", "page-b"], sessionSecret: "page-adoption-test",
    trustedOrigins: ["http://localhost"], logDir: path.join(dir, "logs"),
    extraImplementations: { lessons: {
      factory: async () => ({ createLessonsModule: deps => createLessonsModule({ ...deps, recognition }) }),
      migrations: () => import("../src/modules/lessons/migrations/index.js"),
    } },
  } });
  let runtime, passed = false;
  const start = async () => { runtime = createApp({ env }); await runtime.workbench.initialize(); };
  const send = async (method, route, body, status = 200, key = randomUUID(), owner = "page-a") => {
    let req = request(runtime.app)[method.toLowerCase()](route)
      .set("Cookie", runtime.workbench.identity.testPrincipalCookie(owner).header.split(";")[0])
      .set("Origin", "http://localhost").set("X-TeachBuddy-Request", "1").set("Idempotency-Key", key);
    if (body !== undefined) req = req.send(body);
    const response = await req;
    assert.equal(response.status, status, JSON.stringify(response.body));
    return response.body;
  };
  await start();
  try {
    const store = (name, bytes, p = principal) => runtime.workbench.files.store(p, { name, bytes },
      { key: randomUUID(), method: "POST", path: "/internal/page-adoption-test" });
    const original = await store("original.txt", Buffer.from("原始文件，使用补充图片预览"));
    const image = await store("page.png", fs.readFileSync(new URL("../../web/e2e/fixtures/materials-resources/samples/page.png", import.meta.url)));
    const supplement = await store("supplement.pdf", fs.readFileSync(new URL("../../web/e2e/fixtures/materials-questions/P.pdf", import.meta.url)));
    const preview = await runtime.workbench.files.ensurePreview(principal, supplement.id);
    const raw = await store("recognition.txt", Buffer.from("port fixture, not an OCR run"));
    let resource = await send("POST", "/api/modules/resources/items", {
      title: "扫描资料", folderId: null, tagIds: [], note: "", fileId: original.id,
    }, 201);
    resource = await send("PUT", `/api/modules/resources/items/${resource.id}/supplement-preview`, {
      baseVersion: resource.version, fileId: original.id, supplementPreviewFileId: supplement.id,
    });
    const machine = { version: 2, blocks: [...doc("机器原文").blocks,
      { type: "math", latex: "x^2+1" },
      { type: "image", fileId: image.id, alt: "原页图", widthMm: 100 }] };
    const result = { state: "ready", resultId: randomUUID(), rawFileId: raw.id,
      imageFileId: preview.pages[0].imageFileId, assetFileIds: [image.id], document: machine,
      location: { kind: "page", fileId: supplement.id, renditionFileId: preview.renditionFileId, page: 1, box: null } };
    results.set(result.resultId, result);
    let lesson = await send("POST", base, { title: "单页课稿", intro: doc("保留开头"), sections: [], materials: [] }, 201);
    const url = `${base}/${lesson.id}`, adoptUrl = `${url}/sections/adopt-page`;
    const content = structuredClone(machine); content.blocks[0] = doc("校对后原文").blocks[0];
    const input = { baseVersion: lesson.version, resourceId: resource.id, resourceVersion: resource.version,
      fileId: supplement.id, renditionFileId: preview.renditionFileId, page: 1, resultId: result.resultId, title: "采用环节", content };
    await send("POST", adoptUrl, { ...input, baseVersion: 999 }, 409);
    await send("POST", adoptUrl, { ...input, resourceVersion: 1 }, 409);
    await send("POST", adoptUrl, { ...input, fileId: raw.id }, 422);
    await send("POST", adoptUrl, { ...input, page: 2 }, 404);
    await send("POST", adoptUrl, { ...input, pageSource: {} }, 422);
    await send("POST", adoptUrl, input, 404, randomUUID(), "page-b");
    result.state = "failed"; await send("POST", adoptUrl, input, 404); result.state = "ready";
    const foreign = await store("foreign.png", fs.readFileSync(new URL("../../web/e2e/fixtures/materials-questions/figure.png", import.meta.url)), { accountKey: "page-b" });
    await send("POST", adoptUrl, { ...input, content: { version: 2, blocks: [{ type: "image", fileId: foreign.id, alt: "", widthMm: 100 }] } }, 404);
    assert.equal((await send("GET", `${url}/history`)).items.length, 1);
    const key = randomUUID();
    lesson = await send("POST", adoptUrl, input, 200, key);
    assert.equal(lesson.sections.length, 1);
    const source = lesson.sections[0].pageSource;
    assert.equal(source.fileId, supplement.id); assert.equal(source.fileName, "supplement.pdf");
    assert.equal(source.resourceVersion, resource.version);
    assert.deepEqual(source.machineDocument, machine); assert.deepEqual(source.adoptedDocument, content);
    assert.deepEqual(await send("POST", adoptUrl, input, 200, key), lesson);
    const changed = writable(lesson); changed.sections[0].content = doc("后续独立修改");
    lesson = await send("PUT", url, changed);
    assert.deepEqual(lesson.sections[0].pageSource, source);
    await send("PUT", url, { ...writable(lesson), sections: [{ ...writable(lesson).sections[0], pageSource: source }] }, 422);
    assert.deepEqual((await send("GET", `${url}/history/2`)).sections[0].content, content);
    const copy = await send("POST", `${url}/copy`, { baseVersion: lesson.version }, 201);
    assert.notEqual(copy.sections[0].id, lesson.sections[0].id);
    assert.deepEqual(copy.sections[0].pageSource, source);
    const target = await send("POST", base, { title: "复用课稿", intro: doc(""), sections: [], materials: [] }, 201);
    const reused = await send("POST", `${base}/${target.id}/sections/copy`, {
      baseVersion: 1, sourceLessonId: lesson.id, sourceVersion: lesson.version, sectionIds: [lesson.sections[0].id],
    });
    assert.deepEqual(reused.sections[0].pageSource, source);
    lesson = await send("POST", `${url}/history/restore`, { baseVersion: lesson.version, version: 2 });
    assert.deepEqual(lesson.sections[0].pageSource, source);
    assert.deepEqual(lesson.sections[0].content, content);
    resource = await send("POST", `/api/modules/resources/items/${resource.id}/deletion`, { baseVersion: resource.version, deleted: true });
    await send("POST", `/api/modules/resources/items/${resource.id}/purge`, { baseVersion: resource.version });
    results.clear();
    runtime.workbench.close(); await start();
    assert.deepEqual(await send("GET", url), lesson);
    assert.deepEqual((await send("GET", `${url}/history/2`)).sections[0].pageSource, source);
    assert.deepEqual(await send("POST", adoptUrl, input, 200, key), { ...lesson, version: 2,
      updatedAt: (await send("GET", `${url}/history/2`)).updatedAt });
    for (const id of [source.fileId, source.imageFileId, source.rawFileId, ...source.assetFileIds])
      assert.ok(runtime.workbench.files.read(principal, id));
    passed = true;
  } finally { runtime.workbench.close(); if (passed) fs.rmSync(dir, { recursive: true, force: true }); }
});
