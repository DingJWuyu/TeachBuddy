import bisect from "bisect";
import minimize from "minimize-golden-section-1d";
import { parseExpression, MathSourceError } from "./expression.js";

// Bounded numerical search, not a proof that every real root has been found.
export function findFunctionPoints(first, second, { min, max, values = {} }) {
  const lo = Math.max(min, first.domain.min, second?.domain.min ?? min);
  const hi = Math.min(max, first.domain.max, second?.domain.max ?? max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo >= hi)
    throw new MathSourceError(
      "invalid-geometry",
      "请设置与函数定义域相交的有效查找范围",
    );
  const variables = ["x", ...Object.keys(values)];
  const f = parseExpression(first.expression, variables),
    g = second ? parseExpression(second.expression, variables) : () => 0;
  const evaluate = (x) => f({ ...values, x }) - g({ ...values, x });
  const count = 2048,
    step = (hi - lo) / count,
    tolerance = Math.max(
      1e-12,
      step * 1e-8,
      Number.EPSILON * Math.max(Math.abs(lo), Math.abs(hi)) * 4,
    );
  const samples = Array.from({ length: count + 1 }, (_, i) => {
    const x = lo + i * step;
    return [x, evaluate(x)];
  });
  if (
    samples.some(
      ([x, y], i) =>
        y === 0 &&
        i < count &&
        samples[i + 1][1] === 0 &&
        evaluate(x + step / 2) === 0 &&
        evaluate(x + step * 0.3819660112501051) === 0,
    )
  )
    throw new MathSourceError(
      "invalid-geometry",
      "此范围存在曲线重合或函数恒为零的区间，不能列为有限个点，请缩小查找范围",
    );
  const roots = [];
  const accept = (x, scale = 1) => {
    const y = f({ ...values, x }),
      residual = Math.abs(evaluate(x));
    // Residual + isolation reject poles, jumps and flat zero intervals.
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      x < lo ||
      x > hi ||
      residual > 1e-8 * scale
    )
      return;
    if (
      evaluate(Math.max(lo, x - step / 8)) === 0 &&
      evaluate(Math.min(hi, x + step / 8)) === 0
    )
      return;
    if (!roots.some((p) => Math.abs(p.x - x) < step * 1e-3))
      roots.push({ x, y: second ? y : 0 });
  };
  for (let i = 0; i <= count; i++) {
    const [x, y] = samples[i];
    if (!Number.isFinite(y)) continue;
    if (y === 0) accept(x);
    if (
      i < count &&
      Number.isFinite(samples[i + 1][1]) &&
      Math.sign(y) !== Math.sign(samples[i + 1][1]) &&
      y !== 0 &&
      samples[i + 1][1] !== 0
    ) {
      const next = samples[i + 1];
      accept(
        bisect(
          (v) => Math.sign(evaluate(v)) !== Math.sign(y),
          x,
          next[0],
          tolerance,
        ),
        Math.max(1e-12, Math.min(Math.abs(y), Math.abs(next[1]))),
      );
    }
    // A local minimum of |f-g| also finds tangent/double roots without a sign change.
    if (
      i > 0 &&
      i < count &&
      Math.abs(y) < Math.abs(samples[i - 1][1]) &&
      Math.abs(y) < Math.abs(samples[i + 1][1])
    ) {
      const a = samples[i - 1][0],
        b = samples[i + 1][0];
      const best = minimize((v) => Math.abs(evaluate(v)), {
        lowerBound: a,
        upperBound: b,
        tolerance,
        maxIterations: 100,
      });
      accept(
        best,
        Math.max(
          1e-12,
          Math.min(Math.abs(samples[i - 1][1]), Math.abs(samples[i + 1][1])),
        ),
      );
    }
    if (roots.length > 100)
      throw new MathSourceError(
        "invalid-geometry",
        "候选点太多，请缩小查找范围",
      );
  }
  return roots.sort((a, b) => a.x - b.x);
}
