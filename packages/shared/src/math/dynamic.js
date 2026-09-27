import { parseExpression, MathSourceError } from "./expression.js";
import { resolveElements } from "./geometry.js";
import { renderGraphic } from "./graphics.js";

export function parameterOnGrid(parameter, value) {
  const n = (value - parameter.min) / parameter.step;
  return (
    Number.isFinite(value) &&
    value >= parameter.min &&
    value <= parameter.max &&
    Math.abs(n - Math.round(n)) <= 1e-9 * Math.max(1, Math.abs(n))
  );
}
export function snapParameter(parameter, value) {
  return Number(
    Math.max(
      parameter.min,
      Math.min(
        parameter.max,
        parameter.min +
          Math.round((value - parameter.min) / parameter.step) * parameter.step,
      ),
    ).toPrecision(12),
  );
}
export function dynamicState(source, stepId = source.initialStepId) {
  const step = source.steps.find((step) => step.id === stepId);
  return {
    stepId: step?.id ?? null,
    values: Object.fromEntries(
      step
        ? step.values.map((p) => [p.name, p.value])
        : source.parameters.map((p) => [p.name, p.initial]),
    ),
    visibleIds: step?.visibleIds ?? source.scene.elements.map((e) => e.id),
  };
}
// Resolve all coordinates with the same closed grammar as static graphics.
// Exploration can hide an undefined object; persisted presets must all render.
export function dynamicPlane(source, state, tolerant = false) {
  const variables = source.parameters.map((p) => p.name);
  const evaluate = (text) => {
    const value = parseExpression(text, variables)(state.values);
    if (!Number.isFinite(value))
      throw new MathSourceError("invalid-geometry", "此取值下无定义");
    return String(value);
  };
  const interpolate = (text) =>
    text.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match, name) =>
      Object.hasOwn(state.values, name) ? String(state.values[name]) : match,
    );
  const point = (at) => ({ x: evaluate(at.x), y: evaluate(at.y) });
  const resolved = resolveElements(source.scene.elements, state.values, { tolerant, visibleIds: state.visibleIds, viewport: source.scene.viewport });
  const undefinedIds = [...resolved.undefinedIds];
  const elements = [];
  for (const original of resolved.elements) {
    if (!state.visibleIds.includes(original.id)) continue;
    try {
      const e = structuredClone(original);
      if (e.label) e.label.text = interpolate(e.label.text);
      if (e.text !== undefined) e.text = interpolate(e.text);
      if (e.at) e.at = point(e.at);
      if (e.from) e.from = point(e.from);
      if (e.to) e.to = point(e.to);
      if (e.center) e.center = point(e.center);
      if (e.points) e.points = e.points.map(point);
      if (e.rx) {
        e.rx = evaluate(e.rx);
        e.ry = evaluate(e.ry);
      }
      if (e.expression) {
        parseExpression(e.expression, ["x", ...variables]);
      }
      if (tolerant)
        renderGraphic(
          {
            kind: "plane",
            scene: { viewport: source.scene.viewport, elements: [e] },
          },
          { parameters: state.values },
        );
      elements.push(e);
    } catch (error) {
      if (!tolerant || !(error instanceof MathSourceError)) throw error;
      undefinedIds.push(original.id);
    }
  }
  return {
    plane: {
      schemaVersion: 1,
      kind: "plane",
      scene: { ...source.scene, elements },
    },
    undefinedIds,
  };
}
export function renderDynamic(source, options = {}) {
  for (const step of source.steps) {
    const state = dynamicState(source, step.id);
    renderGraphic(dynamicPlane(source, state).plane, {
      parameters: state.values,
    });
  }
  const state = dynamicState(source);
  return renderGraphic(dynamicPlane(source, state).plane, {
    ...options,
    parameters: state.values,
  });
}
