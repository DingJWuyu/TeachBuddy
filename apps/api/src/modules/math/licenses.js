import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
export const mathDependencyFiles = {
  mathjs: ["../../LICENSE", "../../NOTICE"],
  "@flatten-js/core": ["../LICENSE"],
  three: ["../LICENSE"],
  bisect: ["LICENSE"],
  "minimize-golden-section-1d": ["LICENSE"],
};
let licenses;
export async function mathDependencyLicenses() {
  licenses ??= Promise.all(
    Object.entries(mathDependencyFiles).map(async ([name, files]) => ({
      name,
      text: (
        await Promise.all(
          files.map((file) =>
            fs.readFile(
              path.resolve(path.dirname(require.resolve(name)), file),
              "utf8",
            ),
          ),
        )
      ).join("\n"),
    })),
  ).catch((error) => {
    licenses = null;
    throw error;
  });
  return licenses;
}
