import { updateParameter } from "../../web/src/features/math/editing.js";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import {
  startRealMath,
  registerMath,
} from "./fixtures/math-real.mjs";
import {
  emptySource,
  newElement,
  cubeSource,
  dynamicSource,
  defaultStyle,
} from "../../web/src/features/math/model.js";
import { viewportTransform } from "@refatos/shared/math/graphics";
import {
  resolveElements,
  spatialSurfaces,
} from "@refatos/shared/math/geometry";
import { findFunctionPoints } from "@refatos/shared/math/analysis";

const root = "/api/modules/math/v1/works";
test("real-auth mathematical extensions: persisted expressions, linked geometry, sections, validation and immutable exports", async () => {
  const world = await startRealMath();
  let passed = false;
  try {
    const { client, session } = await registerMath(
      world,
      "math-capabilities@example.test",
    );
    const write = (route, body, method = "POST") =>
      client.request(method, route, {
        body,
        headers: { "Idempotency-Key": randomUUID() },
      });
    const create = (source) =>
      write(root, { title: "数学功能验证", source, originalFileId: null });
    const bytes = async (id) => {
      const stream = await world.workbench.files.open(session.account, id),
        chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      return Buffer.concat(chunks);
    };
    const svg = async (work) => {
      const result = await write(`${root}/${work.id}/exports`, {
        version: work.version,
        format: "svg",
        width: 1600,
        background: "transparent",
      });
      assert.equal(result.status, 201, result.text);
      return (await bytes(result.json.file.id)).toString();
    };
    const source = emptySource("plane");
    for (const expression of [
      "x²-2x-3",
      "2(x+1)",
      "sin(π x)",
      "log(x,2)",
      "-1 < x < 1 ? x² : 2x",
    ]) {
      source.scene.elements = [{ ...newElement("function", "f"), expression }];
      const result = await create(source);
      assert.equal(result.status, 201, result.text);
      assert.equal(result.json.render.state, "ready", expression);
      assert.equal(
        (await client.request("GET", `${root}/${result.json.id}`)).json.source
          .scene.elements[0].expression,
        expression,
      );
      assert.match(await svg(result.json), /data-object="f"/);
    }
    for (const expression of [
      "process.exit()",
      "x=2",
      "x.constructor",
      "[1,2]",
      'import("fs")',
      'evaluate("x")',
      "f(x)=x",
      "x;2",
    ]) {
      source.scene.elements = [{ ...newElement("function", "f"), expression }];
      const result = await create(source);
      assert.equal(result.status, 201, result.text);
      assert.equal(result.json.render.state, "invalid", expression);
      assert.equal(result.json.render.posterFileId, null);
    }
    const point = (id, x, y) => ({
      ...newElement("point", id),
      at: { x: String(x), y: String(y) },
    });
    const construct = (id, type, kind, refs) => ({
      ...newElement(type, id),
      construction: { kind, refs },
    });
    source.scene.elements = [
      point("A", 0, 0),
      point("B", 4, 0),
      point("P", 1, 2),
      construct("L", "line", "segment", ["A", "B"]),
      construct("M", "point", "midpoint", ["A", "B"]),
      construct("H", "point", "projection", ["P", "L"]),
      construct("K", "line", "perpendicular", ["P", "L"]),
      construct("J", "line", "parallel", ["P", "L"]),
      construct("I", "point", "intersection", ["K", "L"]),
      construct("C", "ellipse", "circle", ["A", "B"]),
    ];
    const created = await create(source);
    assert.equal(created.status, 201, created.text);
    assert.equal(created.json.render.state, "ready");
    const resolved = resolveElements(
      created.json.source.scene.elements,
    ).elements;
    assert.deepEqual(resolved.find((e) => e.id === "M").at, { x: "2", y: "0" });
    assert.deepEqual(resolved.find((e) => e.id === "H").at, { x: "1", y: "0" });
    assert(
      Math.abs(Number(resolved.find((e) => e.id === "I").at.x) - 1) < 1e-10,
    );
    assert.equal(resolved.find((e) => e.id === "C").rx, "4");
    const originalSvg = await svg(created.json);
    const expected = viewportTransform(source.scene.viewport).map([2, 0]);
    assert(originalSvg.includes(`cx="${expected[0]}" cy="${expected[1]}"`));
    source.scene.elements[1].at.x = "2";
    const changed = await write(
      `${root}/${created.json.id}`,
      { title: "已修改", baseVersion: 1, source },
      "PUT",
    );
    assert.equal(changed.status, 200, changed.text);
    assert.equal(changed.json.render.state, "ready");
    assert.deepEqual(
      (await client.request("GET", `${root}/${created.json.id}/versions/1`))
        .json.source.scene.elements[1].at,
      { x: "4", y: "0" },
    );
    assert.equal(await svg(created.json), originalSvg);
    const bad = structuredClone(source);
    bad.scene.elements[0].construction = { kind: "midpoint", refs: ["M", "B"] };
    assert.equal((await create(bad)).status, 422);
    bad.scene.elements[0].construction = {
      kind: "midpoint",
      refs: ["missing", "B"],
    };
    assert.equal((await create(bad)).status, 422);
    const space = cubeSource();
    space.sections = [
      {
        id: "S",
        plane: { a: 0, b: 0, c: 1, d: 1 },
        style: { ...defaultStyle(), fill: "#e9a23b" },
      },
    ];
    const solid = await create(space);
    assert.equal(solid.status, 201, solid.text);
    assert.equal(solid.json.render.state, "ready");
    assert.deepEqual(
      spatialSurfaces(solid.json.source).sections[0].points.map((p) => [
        p.x,
        p.y,
        p.z,
      ]),
      [
        [0, 0, 1],
        [2, 0, 1],
        [2, 2, 1],
        [0, 2, 1],
      ],
    );
    assert.match(await svg(solid.json), /data-surface="S"/);
    for (const alter of [
      (s) => (s.sections[0].plane.c = 0),
      (s) => (s.sections[0].plane.d = 3),
      (s) => s.faces.pop(),
      (s) => (s.points[0].z = 0.5),
    ]) {
      const bad = structuredClone(space);
      alter(bad);
      const result = await create(bad);
      assert.equal(result.status, 201, result.text);
      assert.equal(result.json.render.state, "invalid");
    }
    const dynamic = dynamicSource();
    dynamic.animation = { parameter: "h", seconds: 2, mode: "once" };
    dynamic.traceIds = ["P"];
    const animated = await create(dynamic);
    assert.equal(animated.status, 201, animated.text);
    assert.equal(animated.json.render.state, "ready");
    const html = (
      await bytes(animated.json.render.presentationFileId)
    ).toString();
    assert.match(html, /MathPresentation/);
    assert.match(html, /data:font/);
    assert.doesNotMatch(html, /<script[^>]+src=/);
    for (const name of ["and", "true", "mod"]) {
      const renamed = updateParameter(dynamic, 0, {
        ...dynamic.parameters[0],
        name,
      });
      const result = await create(renamed);
      assert.equal(result.status, 201, result.text);
      assert.equal(result.json.render.state, "ready", name);
    }
    const invalidAnimation = structuredClone(dynamic);
    invalidAnimation.animation.parameter = "missing";
    assert.equal((await create(invalidAnimation)).status, 422);
    const invalidTrace = structuredClone(dynamic);
    invalidTrace.traceIds = ["f"];
    assert.equal((await create(invalidTrace)).status, 422);
    passed = true;
  } finally {
    await world.close();
    if (passed) fs.rmSync(world.directory, { recursive: true, force: true });
  }
});

test("numerical search rejects poles and jumps, includes tangent roots and restricted domains", () => {
  const curve = (expression) => ({
    ...newElement("function", "f"),
    expression,
  });
  const range = { min: -6, max: 6 };
  const roots = findFunctionPoints(curve("x²-2x-3"), null, range);
  assert.equal(roots.length, 2);
  assert(Math.abs(roots[0].x + 1) < 1e-8);
  assert(Math.abs(roots[1].x - 3) < 1e-8);
  assert.equal(findFunctionPoints(curve("1/(x-0.37)"), null, range).length, 0);
  assert.equal(
    findFunctionPoints(curve("x < 0.1 ? -1 : 1"), null, range).length,
    0,
  );
  const tangent = findFunctionPoints(curve("(x-0.37)^2"), null, range);
  assert.equal(tangent.length, 1);
  assert(Math.abs(tangent[0].x - 0.37) < 1e-8);
  assert.equal(findFunctionPoints(curve("x^2+0.001"), null, range).length, 0);
  const intersections = findFunctionPoints(curve("x²"), curve("2"), range);
  assert.equal(intersections.length, 2);
  assert(Math.abs(intersections[1].x - Math.sqrt(2)) < 1e-8);
  assert.equal(
    findFunctionPoints(
      { ...curve("x²-4"), domain: { min: 0, max: 5 } },
      null,
      range,
    ).length,
    1,
  );
  assert.throws(
    () => findFunctionPoints(curve("x"), curve("x"), range),
    /重合/,
  );
  assert.throws(
    () => findFunctionPoints(curve("sqrt(x)"), curve("sqrt(x)"), range),
    /重合/,
  );
  assert.throws(
    () => findFunctionPoints(curve("x < 0 ? 0 : x"), null, range),
    /恒为零/,
  );
  const large = findFunctionPoints(
    { ...curve("x-999999.995"), domain: { min: 999999.99, max: 1000000 } },
    null,
    { min: 999999.99, max: 1000000 },
  );
  assert.equal(large.length, 1);
  assert(Math.abs(large[0].x - 999999.995) < 1e-8);
});
