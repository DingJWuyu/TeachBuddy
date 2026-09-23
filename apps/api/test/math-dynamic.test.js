import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  startRealMath,
  registerMath,
} from "../../web/e2e/fixtures/math-static/real.mjs";
import {
  dynamicSource,
  emptySource,
} from "../../web/src/features/math/model.js";
import { validate } from "../src/modules/math/contract.js";
const root = "/api/modules/math/v1/works";
const evidence = process.env.M42_EVIDENCE_DIR
  ? path.resolve(process.env.M42_EVIDENCE_DIR)
  : fileURLToPath(
      new URL(
        "../../../test-results/evidence/M42/v1/artifacts/",
        import.meta.url,
      ),
    );
test("real HTTP dynamic presets, relation failures, public port, identity, immutable export and two restarts", async () => {
  let world = await startRealMath();
  const directory = world.directory;
  let passed = false;
  try {
    let { client, session } = await registerMath(
      world,
      "dynamic-api@example.test",
    );
    const other = await registerMath(world, "dynamic-other@example.test");
    const write = (method, route, body, key = randomUUID(), c = client) =>
      c.request(method, route, { body, headers: { "Idempotency-Key": key } });
    // The same existing database first contains M41 source and fixed output.
    const formula = await write("POST", root, {
      title: "既有公式",
      source: { ...emptySource("formula"), latex: "x^2" },
      originalFileId: null,
    });
    assert.equal(formula.status, 201);
    const input = {
        title: "M-D",
        source: dynamicSource(),
        originalFileId: null,
      },
      key = randomUUID();
    const created = await write("POST", root, input, key);
    assert.equal(created.status, 201, created.text);
    validate("Work", created.json);
    const id = created.json.id,
      route = `${root}/${id}`;
    assert.equal(created.json.render.state, "ready");
    assert(created.json.render.presentationFileId);
    const source = structuredClone(input.source);
    source.initialStepId = "translate";
    source.steps[1].title = "平移与定位";
    const update = { baseVersion: 1, title: "修改动态", source },
      updateKey = randomUUID();
    const changed = await write("PUT", route, update, updateKey);
    assert.equal(changed.status, 200, changed.text);
    assert.deepEqual(
      (await write("PUT", route, update, updateKey)).json,
      changed.json,
    );
    assert.equal((await write("PUT", route, update)).status, 409);
    assert.equal(
      (await write("POST", root, { ...input, title: "另一请求" }, key)).status,
      409,
    );
    const variants = [
      (s) => (s.parameters[0].name = "x"),
      (s) => (s.parameters[0].max = 3.1),
      (s) => (s.parameters[0].initial = 0.1),
      (s) => s.steps[0].values.pop(),
      (s) => s.steps[0].visibleIds.push("missing"),
      (s) => (s.drags[0].xParameter = "a"),
      (s) => (s.steps[1].id = s.steps[0].id),
      (s) => (s.parameters[1].name = "a"),
    ];
    for (const mutate of variants) {
      const bad = structuredClone(source);
      mutate(bad);
      const result = await write("PUT", route, {
        ...update,
        baseVersion: 2,
        source: bad,
      });
      assert.equal(result.status, 422, result.text);
      assert.equal(result.json.type, "/problems/math/invalid-math-source");
    }
    const invalid = structuredClone(source);
    invalid.scene.elements[0].expression = "x+)";
    const result = await write("PUT", route, {
      ...update,
      baseVersion: 2,
      source: invalid,
    });
    assert.equal(result.json.render.state, "invalid");
    assert.equal(result.json.render.presentationFileId, null);
    const exportInput = {
      version: 2,
      format: "html",
      background: "transparent",
      width: 1600,
    };
    const exportKey = randomUUID();
    const exported = await write(
      "POST",
      `${route}/exports`,
      exportInput,
      exportKey,
    );
    assert.equal(exported.status, 201, exported.text);
    assert.equal(exported.json.offline, "self-contained");
    assert.equal(exported.json.file.id, changed.json.render.presentationFileId);
    validate("WorkExport", exported.json);
    for (const url of [
      route,
      `${route}/versions/1`,
      `${route}/reference`,
      `/api/workbench/files/${exported.json.file.id}/content`,
    ]) {
      assert.equal(
        (await client.request("GET", url, { page: null })).status,
        401,
      );
      assert.equal((await other.client.request("GET", url)).status, 404);
    }
    assert.equal(
      (
        await write(
          "POST",
          `${route}/exports`,
          exportInput,
          randomUUID(),
          other.client,
        )
      ).status,
      404,
    );
    const port = world.workbench.loader.get("math").port;
    const portResult = await port.operations.getWork({
      principal: session.account,
      id,
    });
    assert.equal(portResult.body.version, 3);
    const portCreated = await port.operations.createWork({
      principal: session.account,
      key: randomUUID(),
      input,
    });
    assert.equal(portCreated.status, 201);
    assert.equal(
      (
        await port.operations.exportWork({
          principal: session.account,
          key: randomUUID(),
          id: portCreated.body.id,
          input: { ...exportInput, version: 1 },
        })
      ).status,
      201,
    );
    for (let i = 0; i < 2; i++) {
      const jar = client.jar;
      await world.close();
      world = await startRealMath({ directory });
      client = world.client();
      client.jar = jar;
      assert.deepEqual(
        (await write("POST", root, input, key)).json,
        created.json,
      );
      assert.deepEqual(
        (await write("POST", `${route}/exports`, exportInput, exportKey)).json,
        exported.json,
      );
      assert.deepEqual(
        (await client.request("GET", `${root}/${formula.json.id}`)).json,
        formula.json,
      );
      assert.deepEqual(
        (await client.request("GET", `${route}/versions/2`)).json.source,
        source,
      );
    }
    fs.mkdirSync(evidence, { recursive: true });
    fs.writeFileSync(
      path.join(evidence, "dynamic-api.json"),
      JSON.stringify(
        {
          created: created.json,
          changed: changed.json,
          exported: exported.json,
          restarts: 2,
          invalid: result.json.render,
        },
        null,
        2,
      ),
    );
    passed = true;
  } finally {
    await world.close();
    if (passed) fs.rmSync(directory, { recursive: true, force: true });
  }
});
