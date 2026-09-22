import fs from "node:fs";
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
  if (!["formula", "plane", "space"].includes(source.kind))
    throw mathError("unsupported-work-version", "/source/kind");
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
  if (source.kind === "plane") {
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
