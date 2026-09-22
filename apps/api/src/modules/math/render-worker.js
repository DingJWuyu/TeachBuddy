import { parentPort, workerData } from "node:worker_threads";
import sharp from "sharp";
import { renderDynamic } from "../../../../../packages/shared/src/math/dynamic.js";
import { renderGraphic } from "../../../../../packages/shared/src/math/graphics.js";
import { registerAndReadFont } from "./font.js";
import { mathFontStyle } from "../../../../../packages/shared/src/math/formula.js";
import { renderFormula } from "./formula.js";
try {
  let svg =
    workerData.source.kind === "formula"
      ? await renderFormula(workerData.source, workerData.options)
      : workerData.source.kind === "dynamic"
        ? renderDynamic(workerData.source, workerData.options)
        : renderGraphic(workerData.source, workerData.options);
  if (workerData.source.kind !== "formula")
    svg = svg.replace(
      /(<svg[^>]*>)/,
      `$1${mathFontStyle(await registerAndReadFont())}`,
    );
  if (workerData.options.format !== "svg") {
    const width = Number(svg.match(/width="([\d.]+)"/)[1]);
    const height = Number(svg.match(/height="([\d.]+)"/)[1]);
    if (width * height > 24000000)
      throw Object.assign(new Error("pixel-limit"), { pixelLimit: true });
  }
  const bytes =
    workerData.options.format === "svg"
      ? Buffer.from(svg)
      : await sharp(Buffer.from(svg), { limitInputPixels: 24000000 })
          .png()
          .toBuffer();
  parentPort.postMessage({ bytes });
} catch (error) {
  parentPort.postMessage({
    error: {
      reason: error.reason,
      message: error.message,
      pixelLimit: error.pixelLimit,
    },
  });
}
