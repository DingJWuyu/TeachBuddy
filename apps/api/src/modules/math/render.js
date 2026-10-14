import { Worker } from "node:worker_threads";
import { MathSourceError } from "@refatos/shared/math/expression";
import { mathError } from "./contract.js";
export const rendererVersion =
  "math-v5-mathjs15.2-geometry-animation";
export const workshopRendererVersion = "math-v6-workshop-geogebra-local";
export const supportedRendererVersions = new Set([rendererVersion, workshopRendererVersion]);
export async function renderWorkshopFormulaAssets(source) {
  return renderWorker(source, {}, "workshop-formulas");
}
export async function renderSource(source, options = {}) {
  const viewport = source.scene?.viewport ?? source.viewport;
  const width = options.width ?? viewport?.width;
  const height = viewport
    ? Math.round((width * viewport.height) / viewport.width)
    : 0;
  if (options.format !== "svg" && width * height > 24000000)
    throw mathError("unsupported-export", "/width", "pixel-limit");
  return renderWorker(source, options);
}
function renderWorker(source, options, action) {
  // CPU work belongs off the HTTP event loop so the contract's deadline can
  // actually interrupt rendering, including native rasterization.
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./render-worker.js", import.meta.url), {
      workerData: { source, options, action },
    });
    let completed = false;
    const finish = (error, bytes) => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      worker.terminate();
      if (error) reject(error);
      else resolve(bytes);
    };
    const timer = setTimeout(
      () => finish(mathError("render-unavailable", undefined, undefined, 503)),
      30000,
    );
    worker.once("message", (result) => {
      if (result.error) {
        const { reason, message, pixelLimit } = result.error;
        finish(
          pixelLimit
            ? mathError("unsupported-export", "/width", "pixel-limit")
            : reason
              ? new MathSourceError(reason, message)
              : mathError("render-unavailable", undefined, undefined, 503),
        );
      } else if (action === "workshop-formulas") finish(null, result.formulaAssets);
      else if (result.bytes.length > 100 * 1024 * 1024)
        finish(mathError("unsupported-export", "/format", "byte-limit"));
      else finish(null, Buffer.from(result.bytes));
    });
    worker.once("error", () =>
      finish(mathError("render-unavailable", undefined, undefined, 503)),
    );
    worker.once("exit", () => {
      if (!completed)
        finish(mathError("render-unavailable", undefined, undefined, 503));
    });
  });
}
