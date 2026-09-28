import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { invalidInput } from "../problems.js";
const location = fileURLToPath(
  new URL(
    "../../contracts/math.openapi.json",
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
