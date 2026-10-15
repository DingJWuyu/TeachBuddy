import { mathDependencyLicenses } from './licenses.js';
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import {
  isolatedHtml,
  htmlLimit,
} from "@teachbuddy/shared/math/isolation";
import {
  presentationCss,
} from "@teachbuddy/shared/math/presentation";
import { mathFontStyle } from "@teachbuddy/shared/math/formula";
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
let runtimeBundle;
async function nativeRuntime() {
  runtimeBundle ??= build({ entryPoints: [fileURLToPath(import.meta.resolve('@teachbuddy/shared/math/offline'))],
    bundle: true, write: false, platform: 'browser', format: 'iife', globalName: 'MathPresentation',
    target: 'es2022', minify: true, legalComments: 'inline',
  }).then(result => result.outputFiles[0].text).catch(error => { runtimeBundle = null; throw error; });
  return runtimeBundle;
}
export async function dynamicPresentation(source) {
  const runtime = await nativeRuntime();
  const safe = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>${presentationCss}</style><main id="presentation"></main><script type="application/json" id="third-party-licenses">${safe(await mathDependencyLicenses())}</script><script>${runtime}\nMathPresentation.mount(document.getElementById('presentation'),${safe(source)},${safe(mathFontStyle(await registerAndReadFont()))});</script></html>`;
  return Buffer.from(isolatedHtml(html, false));
}
export { isolatedHtml };
