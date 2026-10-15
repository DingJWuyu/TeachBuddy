import { parentPort, workerData } from "node:worker_threads";
import sharp from "sharp";
import { renderDynamic } from "@teachbuddy/shared/math/dynamic";
import { renderGraphic } from "@teachbuddy/shared/math/graphics";
import { registerAndReadFont } from "./font.js";
import { mathFontStyle } from "@teachbuddy/shared/math/formula";
import { renderFormula } from "./formula.js";
try {
  if (workerData.action === "workshop-formulas") {
    const formulaAssets = [];
    for (const formula of workerData.source.formulas) {
      // The composite and classroom each embed the fixed font once.
      const svg = (await renderFormula(formula, {})).replace(/<style>[\s\S]*?<\/style>/g, "");
      formulaAssets.push({ id: formula.id, svg });
    }
    parentPort.postMessage({ formulaAssets });
  } else {
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
  }
} catch (error) {
  parentPort.postMessage({
    error: {
      reason: error.reason,
      message: error.message,
      pixelLimit: error.pixelLimit,
    },
  });
}
