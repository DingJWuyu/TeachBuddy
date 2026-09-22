import YAML from "yaml";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { startResourcesFixture } from "../../web/e2e/fixtures/materials-resources/server.mjs";
const dataDir = new URL("../../../test-results/r32-api/", import.meta.url)
  .pathname;
const schemaRoot = new URL(
  "../../../docs/contracts/workbench/",
  import.meta.url,
);
const specification = YAML.parse(
  fs.readFileSync(new URL("materials.openapi.yaml", schemaRoot), "utf8"),
);
const validator = new Ajv({ strict: false });
addFormats(validator);
validator.addSchema(
  YAML.parse(
    fs.readFileSync(new URL("first-flow.openapi.yaml", schemaRoot), "utf8"),
  ),
  "first-flow.openapi.yaml",
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
          "../../web/e2e/fixtures/materials/samples/c22.pdf",
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
  fixture = await startResourcesFixture({ dataDir });
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
    fixture = await startResourcesFixture({ dataDir });
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

test("MC12 分类移动删除、组合检索及跨账户隔离", async () => {
  fixture = await startResourcesFixture({ dataDir });
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

test("MC13-15 替换、补充预览、固定快照、删除恢复及幂等", async () => {
  fixture = await startResourcesFixture({ dataDir });
  try {
    const file = await upload(),
      second = await upload();
    const input = {
      title: "固定采用",
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
    const snapshot = (await request("GET", base + "/for-reference")).body;
    assert.equal(snapshot.snapshot.fileId, file.id);
    assert.equal(snapshot.snapshot.note, undefined);
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
    const adopted = fixture.resources.port.readForReferenceV2(
      { accountKey: "r32-a" },
      item.id,
    );
    current = await request("PUT", base + "/file", {
      baseVersion: 2,
      fileId: second.id,
    });
    assert.equal(current.status, 200);
    assert.equal(current.body.supplementPreviewFileId, null);
    assert.equal(current.body.note, "私人备注");
    assert.equal(adopted.snapshot.fileId, file.id);
    assert.equal(adopted.snapshot.supplementPreviewFileId, second.id);
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
      (await request("GET", base + "/for-reference")).body.snapshot.fileId,
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

test("MC14 lessons Adapter 通过 HTTP 固定采用、拒绝过期、显式更新和重启", async () => {
  fixture = await startResourcesFixture({ dataDir });
  try {
    const f1 = await upload(),
      f2 = await upload();
    const resource = (
      await request("POST", "/api/modules/resources/items", {
        title: "引用课件",
        fileId: f1.id,
        folderId: null,
        tagIds: [],
        note: "不进快照",
      })
    ).body;
    const first = (
      await request("POST", "/fixture/adopt", {
        resourceId: resource.id,
        resourceVersion: 1,
      })
    ).body;
    assert.equal(first.snapshot.fileId, f1.id);
    await request("PUT", `/api/modules/resources/items/${resource.id}/file`, {
      baseVersion: 1,
      fileId: f2.id,
    });
    let refs = (await request("GET", "/fixture/references")).body.items;
    assert.equal(refs.find((r) => r.id === first.id).snapshot.fileId, f1.id);
    assert.equal(refs.find((r) => r.id === first.id).latestVersion, 2);
    assert.equal(
      (
        await request("POST", "/fixture/adopt", {
          id: first.id,
          resourceId: resource.id,
          resourceVersion: 1,
        })
      ).status,
      409,
    );
    const updated = (
      await request("POST", "/fixture/adopt", {
        id: first.id,
        resourceId: resource.id,
        resourceVersion: 2,
      })
    ).body;
    assert.equal(updated.snapshot.fileId, f2.id);
    assert.equal(updated.note, "课堂保留注记");
    await fixture.close();
    fixture = await startResourcesFixture({ dataDir });
    assert.equal(
      (await request("GET", "/fixture/references")).body.items.find(
        (r) => r.id === first.id,
      ).snapshot.fileId,
      f2.id,
    );
    assert.equal(
      (
        await request(
          "GET",
          `/api/modules/lessons/v2/resource-usages/${resource.id}`,
        )
      ).body.items[0].adoptedVersion,
      2,
    );
  } finally {
    await fixture.close();
  }
});

test("MC12/22 原子拒绝、已删除对象分类清理、公开 operations 与 HTTP 等价", async () => {
  fixture = await startResourcesFixture({ dataDir });
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
    const response = await fetch(fixture.origin + base, { headers: { Connection: "close" } });
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

test("R31旧库追加resources迁移后原文件与数据仍可读取", async () => {
  const { createWorkbench } = await import("../src/workbench/index.js");
  const directory = new URL(
    "../../../test-results/r32-upgrade/",
    import.meta.url,
  ).pathname;
  fs.rmSync(directory, { recursive: true, force: true });
  fs.mkdirSync(directory, { recursive: true });
  const old = createWorkbench({
    env: {
      nodeEnv: "test",
      sqlitePath: directory + "resources.sqlite",
      workbench: {
        mode: "test-principal",
        testPrincipals: ["r32-a", "r32-b"],
        sessionSecret: "isolated-r32-fixture",
        filesDir: directory + "files",
        logDir: directory + "logs",
      },
    },
  });
  await old.initialize();
  const file = await old.files.store(
    { accountKey: "r32-a" },
    { name: "旧文件.txt", bytes: Buffer.from("R31保存的原稿") },
    { key: randomUUID(), method: "POST", path: "/api/workbench/files" },
  );
  old.close();
  fixture = await startResourcesFixture({ dataDir: directory });
  try {
    assert.deepEqual(
      (await request("GET", `/api/workbench/files/${file.id}`)).body,
      file,
    );
    const saved = await request("POST", "/api/modules/resources/items", {
      title: "迁移后引用旧原稿",
      fileId: file.id,
      folderId: null,
      tagIds: [],
      note: "",
    });
    assert.equal(saved.status, 201);
    await fixture.close();
    fixture = await startResourcesFixture({ dataDir: directory });
    assert.equal(
      (await request("GET", `/api/modules/resources/items/${saved.body.id}`))
        .body.fileId,
      file.id,
    );
  } finally {
    await fixture.close();
  }
});
