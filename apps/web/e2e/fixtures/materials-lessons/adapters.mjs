import fs from "node:fs";
import YAML from "yaml";
import { ContractError } from "../../../../api/src/workbench/problems.js";
const schema = YAML.parse(
  fs.readFileSync(
    new URL(
      "../../../../api/src/contracts/materials.openapi.yaml",
      import.meta.url,
    ),
    "utf8",
  ),
);
export const examples = Object.fromEntries(
  Object.entries(schema.components.examples).map(([key, example]) => [
    key,
    example.value,
  ]),
);
export function referenceAdapters() {
  const questions = new Map(),
    resources = new Map();
  const read = (map, principal, id) => {
    const value = map.get(id);
    if (principal.accountKey !== "r34-a" || !value)
      throw new ContractError(404, { type: "/problems/workbench/not-found" });
    return structuredClone(value);
  };
  return {
    questions,
    resources,
    questionPort: { readForReferenceV2: (p, id) => read(questions, p, id) },
    resourcePort: { readForReferenceV2: (p, id) => read(resources, p, id) },
  };
}
