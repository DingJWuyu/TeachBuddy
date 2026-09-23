import { Worker } from "node:worker_threads";
import { MathSourceError } from "../../../../../packages/shared/src/math/expression.js";
import { mathError } from "./contract.js";
export const rendererVersion =
  "math-v4-mathjax3.2.2-noto-sc5.2.9-dynamic-step-text";
export async function renderSource(source, options = {}) {
  const viewport = source.scene?.viewport ?? source.viewport;
  const width = options.width ?? viewport?.width;
  const height = viewport
    ? Math.round((width * viewport.height) / viewport.width)
    : 0;
  if (options.format !== "svg" && width * height > 24000000)
    throw mathError("unsupported-export", "/width", "pixel-limit");
  // CPU work belongs off the HTTP event loop so the contract's deadline can
  // actually interrupt rendering, including native rasterization.
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./render-worker.js", import.meta.url), {
      workerData: { source, options },
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
      } else if (result.bytes.length > 100 * 1024 * 1024)
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
