import test from "node:test";
import assert from "node:assert/strict";
import { parseExpression } from "../../../packages/shared/src/math/expression.js";
import {
  projectSpace,
  sampleCurve,
} from "../../../packages/shared/src/math/graphics.js";
test("closed expression and projected coordinate independent expected values", () => {
  assert.equal(parseExpression("-2^2")(), -4);
  assert.equal(parseExpression("2^3^2")(), 512);
  const f = parseExpression("x^2-2*x-2");
  assert.equal(f({ x: 1 }), -3);
  for (const x of [1 - Math.sqrt(3), 1 + Math.sqrt(3)])
    assert(Math.abs(f({ x })) < 1e-12);
  assert.throws(() => parseExpression("process.exit()"));
  assert.throws(() => parseExpression("x", []));
  assert.deepEqual(projectSpace({ x: 2, y: 3, z: 4 }, 0, 0), [2, 4]);
  const paths = sampleCurve(
    parseExpression("1/x"),
    -4,
    4,
    ([x, y]) => [x * 100, 400 - y * 100],
    800,
  );
  assert(paths.length >= 2);
  assert(
    paths.every(
      (points) =>
        !points.some((p) => p[0] < 0) || !points.some((p) => p[0] > 0),
    ),
  );
});
