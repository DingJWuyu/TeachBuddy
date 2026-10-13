import os from 'node:os';
import path from 'node:path';
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { validate } from "../src/modules/math/contract.js";
import { startMathFixture } from "../../web/e2e/fixtures/math-static/server.mjs";
import {
  emptySource,
  newElement,
  cubeSource,
} from "../../web/src/features/math/model.js";
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "preview-math-api-"));
fs.mkdirSync(dataDir, { recursive: true });
let f;
const source = () => {
  const s = emptySource("plane");
  s.scene.elements = [
    { ...newElement("function", "curve"), expression: "x^2-2*x-3" },
  ];
  return s;
};
async function request(
  method,
  path,
  input,
  key = randomUUID(),
  account = "m41-a",
) {
  const response = await fetch(`${f.origin}/api/modules/math/v1/works${path}`, {
    method,
    headers: {
      Cookie: f.workbench.identity
        .testPrincipalCookie(account)
        .header.split(";")[0],
      Origin: f.origin,
      "X-TeachBuddy-Request": "1",
      ...(input
        ? { "Content-Type": "application/json", "Idempotency-Key": key }
        : {}),
    },
    ...(input ? { body: JSON.stringify(input) } : {}),
  });
  return { status: response.status, body: await response.json() };
}
test("real HTTP: source, history, replay, exports, restart and failures", async () => {
  f = await startMathFixture({ dataDir, port: 0 });
  try {
    const key = randomUUID(),
      input = { title: "Q2 函数", source: source(), originalFileId: null };
    const created = await request("POST", "", input, key);
    assert.equal(created.status, 201, JSON.stringify(created));
    validate("Work", created.body);
    const w = created.body;
    assert.equal(w.render.state, "ready");
    assert.deepEqual(await request("POST", "", input, key), created);
    const change = { baseVersion: 1, title: w.title, source: source() };
    change.source.scene.elements[0].expression = "x^2-2*x-2";
    const changed = await request("PUT", `/${w.id}`, change);
    assert.equal(changed.status, 200);
    assert.equal(changed.body.version, 2);
    assert.equal((await request("PUT", `/${w.id}`, change)).status, 409);
    assert.equal(
      (await request("POST", "", { ...input, title: "other" }, key)).status,
      409,
    );
    assert.equal(
      (await request("GET", `/${w.id}`, null, undefined, "m41-b")).status,
      404,
    );
    assert.equal(
      (await request("GET", `/${w.id}/versions/1`)).body.source.scene
        .elements[0].expression,
      "x^2-2*x-3",
    );
    const invalid = structuredClone(change);
    invalid.baseVersion = 2;
    invalid.source.scene.elements[0].expression = "x+)";
    const savedInvalid = await request("PUT", `/${w.id}`, invalid);
    assert.equal(savedInvalid.status, 200);
    assert.equal(savedInvalid.body.render.state, "invalid");
    assert.equal(savedInvalid.body.render.posterFileId, null);
    assert.equal(
      (
        await request("POST", `/${w.id}/exports`, {
          version: 3,
          format: "png",
          background: "transparent",
          width: 1600,
        })
      ).status,
      422,
    );
    const downloads = [];
    for (const format of ["png", "svg", "source"]) {
      const result = await request("POST", `/${w.id}/exports`, {
        version: 2,
        format,
        background: "transparent",
        width: 1600,
      });
      assert.equal(result.status, 201, JSON.stringify(result));
      const fileResponse = await fetch(
        `${f.origin}/api/workbench/files/${result.body.file.id}/content`,
        {
          headers: {
            Cookie: f.workbench.identity
              .testPrincipalCookie("m41-a")
              .header.split(";")[0],
          },
        },
      );
      assert.equal(fileResponse.status, 200);
      const bytes = Buffer.from(await fileResponse.arrayBuffer());
      fs.writeFileSync(
        `${dataDir}/Q2.${format === "source" ? "json" : format}`,
        bytes,
      );
      downloads.push(result.body);
      validate("WorkExport", result.body);
      if (format === "png") {
        const { data, info } = await sharp(bytes)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        assert.equal(info.width, 1600);
        assert(data.some((v, i) => i % 4 === 3 && v === 0));
        assert(data.some((v, i) => i % 4 === 3 && v > 0));
      }
      if (format === "svg") {
        assert.match(bytes.toString(), /<svg/);
        assert.doesNotMatch(bytes.toString().replace(/<style>[\s\S]*?<\/style>/g, ""), /NaN|Infinity/);
      }
    }
    const cube = await request("POST", "", {
      title: "Q6 正方体",
      source: cubeSource(),
      originalFileId: null,
    });
    assert.equal(cube.status, 201, JSON.stringify(cube));
    const port = f.workbench.loader.get("math").port,
      principal = { accountKey: "m41-a" };
    assert.equal(
      (await request("GET", `/${w.id}/reference`)).body.snapshot.workVersion,
      3,
    );
    assert(
      (await port.operations.listWorks({ principal })).body.items.some(
        (v) => v.id === w.id,
      ),
    );
    await f.close();
    f = await startMathFixture({ dataDir, port: 0 });
    assert.deepEqual(await request("POST", "", input, key), created);
    assert.equal((await request("GET", `/${w.id}`)).body.version, 3);
    assert.equal(
      (await request("GET", `/${w.id}/versions`)).body.items.length,
      3,
    );
    const bad = source();
    bad.scene.elements.push({ ...bad.scene.elements[0] });
    assert.equal(
      (
        await request("POST", "", {
          title: "重复对象",
          source: bad,
          originalFileId: null,
        })
      ).status,
      422,
    );
    // Real storage failure: move the immutable poster away, then restore it.
    const poster = f.workbench.db
      .prepare("SELECT blobName FROM materials_files WHERE id=?")
      .get(cube.body.render.posterFileId);
    const posterPath = `${dataDir}/files/blobs/${poster.blobName}`;
    fs.renameSync(posterPath, `${posterPath}.held`);
    const missing = await request("GET", `/${cube.body.id}`);
    assert.equal(missing.status, 503);
    assert.equal(missing.body.type, "/problems/materials/storage-unavailable");
    fs.renameSync(`${posterPath}.held`, posterPath);
    assert.equal((await request("GET", `/${cube.body.id}`)).status, 200);
    // A failed aggregate transaction cannot commit a revision or success receipt.
    f.workbench.db.exec(
      "CREATE TRIGGER math_test_failure BEFORE INSERT ON math_revisions BEGIN SELECT RAISE(ABORT, 'test disk transaction failure'); END",
    );
    const faultKey = randomUUID(),
      faultInput = {
        title: "transaction recovery",
        source: source(),
        originalFileId: null,
      };
    const before = f.workbench.db
      .prepare("SELECT COUNT(*) AS count FROM math_works")
      .get().count;
    assert.equal((await request("POST", "", faultInput, faultKey)).status, 503);
    assert.equal(
      f.workbench.db.prepare("SELECT COUNT(*) AS count FROM math_works").get()
        .count,
      before,
    );
    f.workbench.db.exec("DROP TRIGGER math_test_failure");
    const recovered = await request("POST", "", faultInput, faultKey);
    assert.equal(recovered.status, 201);
    assert.deepEqual(
      await request("POST", "", faultInput, faultKey),
      recovered,
    );
    const deletedWork = await request("POST", `/${cube.body.id}/deletion`, {
      baseVersion: 1,
      deleted: true,
    });
    assert.equal(deletedWork.body.version, 2);
    assert.equal(
      (
        await request("PUT", `/${cube.body.id}`, {
          baseVersion: 2,
          title: "deleted",
          source: cubeSource(),
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request("POST", `/${cube.body.id}/deletion`, {
          baseVersion: 2,
          deleted: false,
        })
      ).body.version,
      3,
    );
    const copied = await request("POST", `/${cube.body.id}/copy`, {
      baseVersion: 3,
      title: "independent copy",
    });
    assert.equal(copied.status, 201);
    assert.notEqual(copied.body.id, cube.body.id);
    const portCreated = await f.workbench.loader
      .get("math")
      .port.operations.createWork({
        principal,
        key: randomUUID(),
        input: { title: "port native", source: source(), originalFileId: null },
      });
    assert.equal(portCreated.status, 201);
    assert.deepEqual(
      (await request("GET", `/${portCreated.body.id}`)).body,
      portCreated.body,
    );
    const portExport = await f.workbench.loader
      .get("math")
      .port.operations.exportWork({
        principal,
        key: randomUUID(),
        id: portCreated.body.id,
        input: {
          version: 1,
          format: "svg",
          background: "transparent",
          width: 1600,
        },
      });
    assert.equal(portExport.status, 201);
    validate("WorkExport", portExport.body);
    fs.writeFileSync(
      `${dataDir}/result.json`,
      JSON.stringify(
        { workId: w.id, created, changed, savedInvalid, downloads, cube },
        null,
        2,
      ),
    );
  } finally {
    await f.close();
  }
});
