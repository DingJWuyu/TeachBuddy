import fs from "node:fs";
import { parameterOnGrid } from "../../../../../packages/shared/src/math/dynamic.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { ContractError, invalidInput } from "../../workbench/problems.js";
const location = fileURLToPath(
  new URL(
    "../../../../../docs/contracts/workbench/math/math.openapi.json",
    import.meta.url,
  ),
);
export const contract = JSON.parse(fs.readFileSync(location, "utf8"));
const documents = new Map([[location, contract]]);
function dereference(value, file = location) {
  if (Array.isArray(value)) return value.map((v) => dereference(v, file));
  if (!value || typeof value !== "object") return value;
  if (value.$ref) {
    const [relative, fragment] = value.$ref.split("#");
    const target = relative ? path.resolve(path.dirname(file), relative) : file;
    if (!documents.has(target))
      documents.set(target, YAML.parse(fs.readFileSync(target, "utf8")));
    let child = documents.get(target);
    for (const segment of fragment.slice(1).split("/")) child = child[segment];
    return dereference(child, target);
  }
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, dereference(v, file)]),
  );
}
const ajv = new Ajv({ strict: false, allErrors: false });
addFormats(ajv);
const validators = new Map();
export function mathError(type, field = "", reason = type, status = 422) {
  return new ContractError(status, {
    type: `/problems/math/${type}`,
    ...(field === undefined ? {} : { field }),
    ...(reason === undefined ? {} : { reason }),
  });
}
export function validate(name, value) {
  if (!validators.has(name))
    validators.set(
      name,
      ajv.compile(dereference(contract.components.schemas[name])),
    );
  const check = validators.get(name);
  if (!check(value)) {
    const e = check.errors[0];
    const field = `${e.instancePath}${e.params.missingProperty ? `/${e.params.missingProperty}` : e.params.additionalProperty ? `/${e.params.additionalProperty}` : ""}`;
    throw invalidInput(
      field,
      e.keyword === "additionalProperties"
        ? "unknown-field"
        : e.keyword === "required"
          ? "required"
          : "out-of-range",
    );
  }
  return value;
}
export function validateSourceRelations(source) {
  const bad = (field, reason) => {
    throw mathError("invalid-math-source", `/source${field}`, reason);
  };
  if (source.schemaVersion !== 1)
    throw mathError("unsupported-work-version", "/source/schemaVersion");
  if (!["formula", "plane", "space", "dynamic", "html"].includes(source.kind))
    throw mathError("unsupported-work-version", "/source/kind");
  validateDynamic(source);
  const view = source.scene?.viewport ?? source.viewport;
  if (view && (view.xMin >= view.xMax || view.yMin >= view.yMax))
    bad("/viewport", "invalid-range");
  const unique = (items, field) => {
    const ids = new Set();
    items.forEach((item, i) => {
      if (ids.has(item.id)) bad(`${field}/${i}/id`, "duplicate-id");
      ids.add(item.id);
    });
    return ids;
  };
  if (["plane", "dynamic"].includes(source.kind)) {
    unique(source.scene.elements, "/scene/elements");
    source.scene.elements.forEach((e, i) => {
      if (e.type === "function" && e.domain.min >= e.domain.max)
        bad(`/scene/elements/${i}/domain`, "invalid-range");
    });
  }
  if (source.kind === "space") {
    const ids = unique(source.points, "/points");
    unique(source.edges, "/edges");
    source.edges.forEach((e, i) => {
      if (!ids.has(e.from) || !ids.has(e.to) || e.from === e.to)
        bad(`/edges/${i}`, "invalid-reference");
    });
  }
}

export function validateDynamic(source) {
  if (source.kind !== "dynamic") return;
  const bad = (field) => {
    throw mathError(
      "invalid-math-source",
      `/source/${field}`,
      "invalid-reference",
    );
  };
  const names = new Set();
  source.parameters.forEach((p, i) => {
    if (
      names.has(p.name) ||
      [
        "x",
        "pi",
        "e",
        "sin",
        "cos",
        "tan",
        "asin",
        "acos",
        "atan",
        "sqrt",
        "abs",
        "exp",
        "ln",
        "log10",
      ].includes(p.name) ||
      p.min >= p.max ||
      p.step <= 0 ||
      !parameterOnGrid(p, p.initial) ||
      !parameterOnGrid(p, p.max)
    )
      bad(`parameters/${i}`);
    names.add(p.name);
  });
  const elements = new Map(source.scene.elements.map((e) => [e.id, e]));
  const bound = new Set();
  source.drags.forEach((d, i) => {
    const point = elements.get(d.pointId);
    if (
      !point ||
      point.type !== "point" ||
      bound.has(d.pointId) ||
      (!d.xParameter && !d.yParameter)
    )
      bad(`drags/${i}`);
    for (const axis of ["x", "y"])
      if (
        d[`${axis}Parameter`] !== null &&
        (!names.has(d[`${axis}Parameter`]) ||
          point.at[axis] !== d[`${axis}Parameter`])
      )
        bad(`drags/${i}`);
    bound.add(d.pointId);
  });
  const steps = new Set();
  source.steps.forEach((step, i) => {
    if (
      steps.has(step.id) ||
      new Set(step.visibleIds).size !== step.visibleIds.length ||
      step.visibleIds.some((id) => !elements.has(id)) ||
      step.values.length !== names.size ||
      new Set(step.values.map((v) => v.name)).size !== names.size
    )
      bad(`steps/${i}`);
    step.values.forEach((v) => {
      const p = source.parameters.find((p) => p.name === v.name);
      if (!p || !parameterOnGrid(p, v.value)) bad(`steps/${i}/values`);
    });
    steps.add(step.id);
  });
  if (
    source.steps.length
      ? !steps.has(source.initialStepId)
      : source.initialStepId !== null
  )
    bad("initialStepId");
}
