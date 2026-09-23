import fs from "node:fs";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
const schema = JSON.parse(
  fs.readFileSync(new URL("./archive.schema.json", import.meta.url), "utf8"),
);
const ajv = new Ajv({ strict: false });
addFormats(ajv);
ajv.addSchema(schema, "manual-data");
const validators = new Map();
export function validateArchive(kind, value) {
  if (!validators.has(kind))
    validators.set(kind, ajv.compile({ $ref: `manual-data#/$defs/${kind}` }));
  if (!validators.get(kind)(value)) throw new Error(`Invalid ${kind}`);
  return value;
}
