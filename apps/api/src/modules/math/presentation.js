import fs from "node:fs/promises";
import {
  isolatedHtml,
  htmlLimit,
} from "../../../../../packages/shared/src/math/isolation.js";
import {
  mountDynamic,
  presentationCss,
} from "../../../../../packages/shared/src/math/presentation.js";
import { mathFontStyle } from "../../../../../packages/shared/src/math/formula.js";
import { registerAndReadFont } from "./font.js";
import { contractError, problems } from "../../workbench/problems.js";

export async function readHtml(files, principal, id) {
  const file = files.read(principal, id);
  if (!(
    file.mediaType === "text/html" ||
    (["text/plain", "application/octet-stream"].includes(file.mediaType) &&
      /\.html?$/i.test(file.name))
  ))
    throw contractError(problems.unsupportedMediaType());
  const stream = await files.open(principal, id);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const bytes = Buffer.concat(chunks);
  if (bytes.length > htmlLimit) return { bytes, text: null };
  try {
    return {
      bytes,
      text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    };
  } catch {
    return { bytes, text: null };
  }
}
export async function dynamicPresentation(source) {
  // Package only these trusted modules. No user source is interpreted as JS.
  const modules = await Promise.all(
    ["expression", "graphics", "dynamic"].map(async (name) =>
      (
        await fs.readFile(
          new URL(
            `../../../../../packages/shared/src/math/${name}.js`,
            import.meta.url,
          ),
          "utf8",
        )
      )
        .replace(/^import[\s\S]*?from ['"][^'"]+['"];\s*/gm, "")
        .replace(/^export /gm, ""),
    ),
  );
  const safe = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>${presentationCss}</style><main id="presentation"></main><script>${modules.join("\n")}\n(${mountDynamic.toString()})(document.getElementById('presentation'),${safe(source)},renderGraphic,dynamicState,dynamicPlane,snapParameter,${safe(mathFontStyle(await registerAndReadFont()))});</script></html>`;
  return Buffer.from(isolatedHtml(html, false));
}
export { isolatedHtml };
