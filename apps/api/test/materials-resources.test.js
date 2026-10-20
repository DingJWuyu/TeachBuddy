import YAML from "yaml";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { startResourcesFixture } from "./fixtures/resources/server.mjs";
const runDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'materials-resources-'));
const dataDir = path.join(runDirectory, 'resources');
let failed = false;
test.afterEach(t => { failed ||= !t.passed; });
test.after(() => {
  if (failed) console.log('保留资源 HTTP 测试现场：' + runDirectory);
  else fs.rmSync(runDirectory, { recursive: true, force: true });
});
const schemaRoot = new URL(
  "../src/contracts/",
  import.meta.url,
);
const specification = YAML.parse(
  fs.readFileSync(new URL("materials.openapi.yaml", schemaRoot), "utf8"),
);
const validator = new Ajv({ strict: false });
addFormats(validator);
validator.addSchema(
  YAML.parse(
    fs.readFileSync(new URL("workbench.openapi.yaml", schemaRoot), "utf8"),
  ),
  "workbench.openapi.yaml",
);
validator.addSchema(specification, "materials.openapi.yaml");
const schemaCache = new Map();
function checkResponse(method, route, status, body) {
  const pathname = route.split("?")[0];
  const entry = Object.entries(specification.paths).find(([pattern]) =>
    new RegExp("^" + pattern.replace(/\{[^}]+\}/g, "[^/]+") + "$").test(
      pathname,
    ),
  );
  const schema =
    entry?.[1]?.[method.toLowerCase()]?.responses?.[status]?.content?.[
      "application/json"
    ]?.schema;
  if (!schema?.$ref) return;
  const ref = "materials.openapi.yaml" + schema.$ref;
  if (!schemaCache.has(ref))
    schemaCache.set(ref, validator.compile({ $ref: ref }));
  const validate = schemaCache.get(ref);
  assert.ok(validate(body), JSON.stringify(validate.errors));
}
let fixture;
async function request(
  method,
  route,
  body,
  { key = randomUUID(), account = "r32-a" } = {},
) {
  const response = await fetch(fixture.origin + route, {
    method,
    headers: {
      // Do not carry a pooled socket across the fixture server lifecycle.
      Connection: "close",
      Cookie: fixture.workbench.identity
        .testPrincipalCookie(account)
        .header.split(";")[0],
      Origin: fixture.origin,
      "X-TeachBuddy-Request": "1",
      "Idempotency-Key": key,
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  const result = {
    status: response.status,
    body: await response.text().then((text) => {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }),
  };
  checkResponse(method, route, result.status, result.body);
  return result;
}
async function upload() {
  const data = new FormData();
  data.append(
    "file",
    new Blob([
      fs.readFileSync(
        new URL(
          "../../../test/fixtures/materials/c22.pdf",
          import.meta.url,
        ),
      ),
    ]),
    "三页课件.pdf",
  );
  const result = await request("POST", "/api/workbench/files", data);
  assert.equal(result.status, 201, JSON.stringify(result));
  return result.body;
}
test("MC02 上传后真实收录，重启仍可读取同一资源和原文件", async () => {
  fs.rmSync(dataDir, { recursive: true, force: true });
  fixture = await startResourcesFixture({ dataDir, port: 0 });
  try {
    const file = await upload();
    const input = {
      title: "三页课件",
      fileId: file.id,
      folderId: null,
      tagIds: [],
      note: "第一课",
    };
    const created = await request(
      "POST",
      "/api/modules/resources/items",
      input,
    );
    assert.equal(created.status, 201, JSON.stringify(created));
    assert.equal(created.body.version, 1);
    await fixture.close();
    fixture = await startResourcesFixture({ dataDir, port: 0 });
    assert.deepEqual(
      (await request("GET", `/api/modules/resources/items/${created.body.id}`))
        .body,
      created.body,
    );
    assert.equal(
      (await request("GET", "/api/modules/resources/items?q=第一课")).body.items
        .length,
      1,
    );
  } finally {
    await fixture.close();
  }
});

test("资源标签颜色持久、旧标签兼容及删除嵌套树资料归未分组", async () => {
  const directory = path.join(runDirectory, 'taxonomy-colors');
  fixture = await startResourcesFixture({ dataDir: directory, port: 0 });
  try {
    const root = randomUUID(), child = randomUUID(), leaf = randomUUID();
    const tag = randomUUID(), legacy = randomUUID();
    const folders = [
      {id:root, name:'高一', parentId:null},
      {id:child, name:'函数', parentId:root},
      {id:leaf, name:'图像', parentId:child},
    ];
    const tags = [{id:tag, name:'复习', color:'#3edc81'}, {id:legacy, name:'旧标签'}];
    const key = randomUUID();
    const saved = await request('PUT', '/api/modules/resources/taxonomy', {baseVersion:1, folders, tags}, {key});
    assert.equal(saved.status, 200, JSON.stringify(saved));
    assert.deepEqual(saved.body.tags, tags);
    assert.deepEqual((await request('PUT', '/api/modules/resources/taxonomy', {baseVersion:1, folders, tags}, {key})).body, saved.body);
    const file = await upload();
    async function create(folderId, title) {
      const result = await request('POST', '/api/modules/resources/items', {title, fileId:file.id, folderId, tagIds:[tag], note:'保留备注'});
      assert.equal(result.status, 201, JSON.stringify(result));
      return result.body;
    }
    const retained = await create(root, '上级资料');
    const direct = await create(child, '直接资料');
    const nested = await create(leaf, '嵌套资料');
    const archived = await create(leaf, '归档资料');
    const archive = await request('POST', `/api/modules/resources/items/${archived.id}/deletion`, {baseVersion:archived.version, deleted:true});
    assert.equal(archive.status, 200, JSON.stringify(archive));
    assert.deepEqual(fixture.resources.port.readReference({accountKey:'r32-a'}, direct.id), direct);
    assert.deepEqual(fixture.resources.port.readReference({accountKey:'r32-a'}, archived.id), archive.body);
    assert.throws(() => fixture.resources.port.readReference({accountKey:'r32-b'}, direct.id), error => error.status === 404);
    assert.throws(() => fixture.resources.port.readReference({accountKey:'r32-a'}, randomUUID()), error => error.status === 404);
    assert.throws(() => fixture.resources.port.readReference({accountKey:'r32-a'}, 'bad-id'), error => error.status === 422);
    await fixture.close();
    fixture = await startResourcesFixture({dataDir:directory, port:0});
    assert.deepEqual((await request('GET', '/api/modules/resources/taxonomy')).body.tags, tags);
    assert.deepEqual((await request('GET', '/api/modules/resources/taxonomy', undefined, {account:'r32-b'})).body.tags, []);
    const invalid = await request('PUT', '/api/modules/resources/taxonomy', {baseVersion:2, folders, tags:[{id:tag, name:'复习', color:'red'}]});
    assert.equal(invalid.status, 422);
    const removed = await request('PUT', '/api/modules/resources/taxonomy', {baseVersion:2, folders:[folders[0]], tags});
    assert.equal(removed.status, 200, JSON.stringify(removed));
    for (const item of [direct, nested, archived]) {
      const current = (await request('GET', `/api/modules/resources/items/${item.id}`)).body;
      assert.equal(current.folderId, null, item.title);
      assert.equal(current.fileId, file.id);
      assert.equal(current.note, '保留备注');
      assert.deepEqual(current.tagIds, [tag]);
      assert.equal(current.version, item.version + (item === archived ? 2 : 1));
    }
    assert.deepEqual((await request('GET', `/api/modules/resources/items/${retained.id}`)).body, retained);
    const archivedCurrent = (await request('GET', `/api/modules/resources/items/${archived.id}`)).body;
    const restored = await request('POST', `/api/modules/resources/items/${archived.id}/deletion`, {baseVersion:archivedCurrent.version, deleted:false});
    assert.equal(restored.status, 200);
    assert.equal(restored.body.folderId, null);
    assert.equal(restored.body.deletedAt, null);
    const stale = await request('PUT', '/api/modules/resources/taxonomy', {baseVersion:2, folders, tags:[]});
    assert.equal(stale.status, 409);
    assert.deepEqual((await request('GET', '/api/modules/resources/taxonomy')).body, removed.body);
    await fixture.close();
    fixture = await startResourcesFixture({dataDir:directory, port:0});
    assert.equal((await request('GET', `/api/modules/resources/items/${nested.id}`)).body.folderId, null);
  } finally { await fixture.close(); }
});

test("MC12 分类移动删除、组合检索及跨账户隔离", async () => {
  fixture = await startResourcesFixture({ dataDir, port: 0 });
  try {
    const root = randomUUID(),
      child = randomUUID(),
      tag = randomUUID();
    let tax = await request("PUT", "/api/modules/resources/taxonomy", {
      baseVersion: 1,
      folders: [
        { id: root, name: "高一", parentId: null },
        { id: child, name: "函数", parentId: root },
      ],
      tags: [{ id: tag, name: "复习" }],
    });
    assert.equal(tax.status, 200);
    const file = await upload();
    const item = (
      await request("POST", "/api/modules/resources/items", {
        title: "函数图像",
        fileId: file.id,
        folderId: child,
        tagIds: [tag],
        note: "板书重点",
      })
    ).body;
    assert.equal(
      (
        await request(
          "GET",
          `/api/modules/resources/items?folderId=${root}&tagIds=${tag}&q=板书`,
        )
      ).body.items[0].id,
      item.id,
    );
    assert.equal(
      (
        await request(
          "GET",
          `/api/modules/resources/items/${item.id}`,
          undefined,
          { account: "r32-b" },
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await request("PUT", "/api/modules/resources/taxonomy", {
          baseVersion: 2,
          folders: [
            { id: root, name: "高一", parentId: child },
            { id: child, name: "函数", parentId: root },
          ],
          tags: [],
        })
      ).status,
      422,
    );
    tax = await request("PUT", "/api/modules/resources/taxonomy", {
      baseVersion: 2,
      folders: [{ id: child, name: "函数", parentId: root }],
      tags: [],
    });
    assert.equal(tax.status, 200, JSON.stringify(tax));
    assert.equal(tax.body.folders[0].parentId, null);
    const current = (
      await request("GET", `/api/modules/resources/items/${item.id}`)
    ).body;
    assert.deepEqual(current.tagIds, []);
    assert.equal(current.version, 2);
    assert.equal(current.folderId, child);
    assert.equal(
      (
        await request("PUT", "/api/modules/resources/taxonomy", {
          baseVersion: 3,
          folders: [],
          tags: [
            { id: randomUUID(), name: "Straße" },
            { id: randomUUID(), name: "STRASSE" },
          ],
        })
      ).status,
      422,
    );
  } finally {
    await fixture.close();
  }
});

test("MC13-15 替换、补充预览、文件历史、删除恢复及幂等", async () => {
  fixture = await startResourcesFixture({ dataDir, port: 0 });
  try {
    const file = await upload(),
      second = await upload();
    const input = {
      title: "保留文件历史",
      fileId: file.id,
      folderId: null,
      tagIds: [],
      note: "私人备注",
    };
    const key = randomUUID();
    const item = (
      await request("POST", "/api/modules/resources/items", input, { key })
    ).body;
    const base = `/api/modules/resources/items/${item.id}`;
    assert.equal((await request("GET", base)).body.fileId, file.id);
    assert.equal((await request("GET", base + "/for-reference")).status, 404);
    assert.equal(fixture.resources.port.readForReferenceV2, undefined);
    assert.equal(
      (
        await request("PUT", base + "/supplement-preview", {
          baseVersion: 1,
          fileId: file.id,
          supplementPreviewFileId: second.id,
        })
      ).status,
      422,
    );
    await fixture.workbench.files.ensurePreview(
      { accountKey: "r32-a" },
      second.id,
    );
    let current = await request("PUT", base + "/supplement-preview", {
      baseVersion: 1,
      fileId: file.id,
      supplementPreviewFileId: second.id,
    });
    assert.equal(current.status, 200, JSON.stringify(current));
    assert.equal(current.body.version, 2);
    current = await request("PUT", base + "/file", {
      baseVersion: 2,
      fileId: second.id,
    });
    assert.equal(current.status, 200);
    assert.equal(current.body.supplementPreviewFileId, null);
    assert.equal(current.body.note, "私人备注");
    const previous = (await request("GET", base + "/history")).body.items.find(
      (entry) => entry.version === 2,
    );
    assert.equal(previous.fileId, file.id);
    assert.equal(previous.supplementPreviewFileId, second.id);
    assert.equal(
      (
        await request("PUT", base + "/file", {
          baseVersion: 2,
          fileId: file.id,
        })
      ).status,
      409,
    );
    current = await request("POST", base + "/deletion", {
      baseVersion: 3,
      deleted: true,
    });
    assert.equal(current.status, 200);
    assert.ok(current.body.deletedAt);
    assert.equal(
      (await request("GET", base)).body.fileId,
      second.id,
    );
    assert.equal(
      (
        await request("PUT", base, {
          baseVersion: 4,
          title: "不得改",
          folderId: null,
          tagIds: [],
          note: "",
        })
      ).status,
      409,
    );
    current = await request("POST", base + "/deletion", {
      baseVersion: 4,
      deleted: false,
    });
    assert.equal(current.body.id, item.id);
    assert.equal(current.body.version, 5);
    assert.deepEqual(
      (await request("POST", "/api/modules/resources/items", input, { key }))
        .body,
      item,
    );
    assert.equal(
      (await request("GET", base, undefined, { account: "r32-b" })).status,
      404,
    );
  } finally {
    await fixture.close();
  }
});

test("MC12/22 原子拒绝、已删除对象分类清理、公开 operations 与 HTTP 等价", async () => {
  fixture = await startResourcesFixture({ dataDir, port: 0 });
  try {
    let tax = (await request("GET", "/api/modules/resources/taxonomy")).body;
    const folder = randomUUID(),
      tag = randomUUID();
    tax = (
      await request("PUT", "/api/modules/resources/taxonomy", {
        baseVersion: tax.version,
        folders: [{ id: folder, name: "临时", parentId: null }],
        tags: [{ id: tag, name: "待整理" }],
      })
    ).body;
    const file = await upload();
    const item = (
      await request("POST", "/api/modules/resources/items", {
        title: "删除后分类",
        fileId: file.id,
        folderId: folder,
        tagIds: [tag],
        note: "",
      })
    ).body;
    const base = `/api/modules/resources/items/${item.id}`;
    await request("POST", base + "/deletion", {
      baseVersion: 1,
      deleted: true,
    });
    await request("PUT", "/api/modules/resources/taxonomy", {
      baseVersion: tax.version,
      folders: [],
      tags: [],
    });
    const deleted = (await request("GET", base)).body;
    assert.equal(deleted.version, 3);
    assert.equal(deleted.folderId, null);
    assert.deepEqual(deleted.tagIds, []);
    const bad = await request("PUT", base, {
      baseVersion: 3,
      title: "非法",
      folderId: null,
      tagIds: [],
      note: "",
      extra: true,
    });
    assert.equal(bad.status, 422);
    assert.deepEqual((await request("GET", base)).body, deleted);
    const key = randomUUID();
    const operation =
      await fixture.resources.port.operations.setResourceDeletion({
        principal: { accountKey: "r32-a" },
        key,
        id: item.id,
        input: { baseVersion: 3, deleted: false },
      });
    assert.deepEqual(
      await request(
        "POST",
        base + "/deletion",
        { baseVersion: 3, deleted: false },
        { key },
      ),
      operation,
    );
    assert.equal(
      (
        await request("PUT", base + "/file", {
          baseVersion: 4,
          fileId: randomUUID(),
        })
      ).status,
      404,
    );
    assert.equal((await request("GET", base)).body.fileId, file.id);
    assert.equal(
      (
        await request("PUT", base + "/supplement-preview", {
          baseVersion: 4,
          fileId: randomUUID(),
          supplementPreviewFileId: null,
        })
      ).status,
      422,
    );
    assert.equal(
      (await request("GET", "/api/modules/resources/items?unknown=true"))
        .status,
      422,
    );
    const response = await fetch(fixture.origin + base, {
      headers: { Connection: "close" },
    });
    assert.equal(response.status, 401);
    assert.equal(
      (
        await request("GET", `/api/workbench/files/${file.id}`, undefined, {
          account: "r32-b",
        })
      ).status,
      404,
    );
    const foreign = await fetch(fixture.origin + base, {
      method: "PUT",
      headers: {
        // Do not carry a pooled socket across the fixture server lifecycle.
        Connection: "close",
        Origin: "http://evil.invalid",
        "Content-Type": "application/json",
        "X-TeachBuddy-Request": "1",
      },
      body: "{}",
    });
    assert.equal(foreign.status, 403);
  } finally {
    await fixture.close();
  }
});

test("已保存原文件经重启收录资源后仍可读取", async () => {
  const { createWorkbench } = await import("../src/workbench/index.js");
  const directory = fs.mkdtempSync(path.join(runDirectory, 'upgrade-'));
  const old = createWorkbench({
    env: {
      nodeEnv: "test",
      sqlitePath: path.join(directory, "resources.sqlite"),
      workbench: {
        mode: "test-principal",
        testPrincipals: ["r32-a", "r32-b"],
        sessionSecret: "isolated-r32-fixture",
        filesDir: path.join(directory, "files"),
        logDir: path.join(directory, "logs"),
      },
    },
  });
  await old.initialize();
  const file = await old.files.store(
    { accountKey: "r32-a" },
    { name: "已保存文件.txt", bytes: Buffer.from("此前保存的原稿") },
    { key: randomUUID(), method: "POST", path: "/api/workbench/files" },
  );
  await old.close();
  fixture = await startResourcesFixture({ dataDir: directory, port: 0 });
  try {
    assert.deepEqual(
      (await request("GET", `/api/workbench/files/${file.id}`)).body,
      file,
    );
    const saved = await request("POST", "/api/modules/resources/items", {
      title: "收录此前保存的原稿",
      fileId: file.id,
      folderId: null,
      tagIds: [],
      note: "",
    });
    assert.equal(saved.status, 201);
    await fixture.close();
    fixture = await startResourcesFixture({ dataDir: directory, port: 0 });
    assert.equal(
      (await request("GET", `/api/modules/resources/items/${saved.body.id}`))
        .body.fileId,
      file.id,
    );
  } finally {
    await fixture.close();
  }
});

test("正文搜索经 HTTP 跨重启、筛选和账户隔离，重试保持幂等", async () => {
  let passed = false;
  fs.mkdirSync(dataDir, { recursive: true });
  const directory = fs.mkdtempSync(path.join(runDirectory, "text-"));
  fixture = await startResourcesFixture({ dataDir: directory, port: 0 });
  try {
    const file = await upload();
    const created = await request("POST", "/api/modules/resources/items", {
      title: "讲义",
      fileId: file.id,
      folderId: null,
      tagIds: [],
      note: "",
    });
    const route =
      "/api/modules/resources/items?q=" + encodeURIComponent("三角形");
    const first = await request("GET", route);
    assert.equal(first.status, 200);
    assert.equal(first.body.search.pending, 0);
    assert.equal(first.body.search.matches[created.body.id].page, 3);
    assert.match(
      first.body.search.matches[created.body.id].excerpt,
      /Q5 三角形/,
    );
    assert.deepEqual(
      (await request("GET", route + "&mediaType=image%2Fpng")).body.items,
      [],
    );
    assert.deepEqual(
      (await request("GET", route, undefined, { account: "r32-b" })).body.search
        .matches,
      {},
    );
    await fixture.close();
    fixture = await startResourcesFixture({ dataDir: directory, port: 0 });
    assert.deepEqual((await request("GET", route)).body, first.body);
    const key = randomUUID();
    const retry = await request(
      "POST",
      "/api/modules/resources/search/retry",
      {},
      { key },
    );
    assert.equal(retry.status, 200);
    assert.deepEqual(retry.body, { accepted: true });
    assert.deepEqual(
      await request("POST", "/api/modules/resources/search/retry", {}, { key }),
      retry,
    );
    assert.deepEqual((await request("GET", route)).body, first.body);
    assert.equal(
      (await request("GET", `/api/modules/resources/items/${created.body.id}`))
        .body.version,
      1,
    );
    const data = new FormData();
    data.append(
      "file",
      new Blob([
        "分层\n教学与 SIN X 教学材料\n" + "ß".repeat(200) + " Needle 原文",
      ]),
      "摘录.txt",
    );
    const plain = (await request("POST", "/api/workbench/files", data)).body;
    const textItem = (
      await request("POST", "/api/modules/resources/items", {
        title: "摘录",
        fileId: plain.id,
        folderId: null,
        tagIds: [],
        note: "",
      })
    ).body;
    const textSearch = (
      await request(
        "GET",
        "/api/modules/resources/items?q=" + encodeURIComponent("分层教学"),
      )
    ).body;
    assert.equal(textSearch.search.matches[textItem.id].page, null);
    assert.match(textSearch.search.matches[textItem.id].excerpt, /SIN X/);
    assert.equal(
      (await request("GET", "/api/modules/resources/items?q=sin%20x")).body
        .items[0].id,
      textItem.id,
    );
    assert.match(
      (await request("GET", "/api/modules/resources/items?q=needle")).body
        .search.matches[textItem.id].excerpt,
      /Needle 原文/,
    );
    passed = true;
  } finally {
    await fixture.close();
    if (passed) fs.rmSync(directory, { recursive: true, force: true });
  }
});
