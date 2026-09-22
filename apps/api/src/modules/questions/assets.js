import { createRequire } from "node:module";
import { stableRequestKey as stableKey } from "./request-key.js";
import sharp from "sharp";
import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import "mathjax-full/js/input/tex/ams/AmsConfiguration.js";
import {
  checkFormula,
  formulaPackages,
} from "../../../../../packages/shared/src/math/formula.js";
const require = createRequire(import.meta.url);
const fontfile =
  require.resolve("@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.woff");
const escape = (x) =>
  x.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
export function createAssetHandler({ store: s, files }) {
  return {
    async run({ principal: p, job, signal, reportProgress }) {
      const task = s.get("tasks", p, job.id);
      if (task.outputFileIds.length)
        return {
          state: "succeeded",
          outputFileIds: task.outputFileIds,
          issues: [],
        };
      const output = [];
      try {
        async function bytes(id) {
          const chunks = [];
          for await (const c of await files.open(p, id)) chunks.push(c);
          return Buffer.concat(chunks);
        }
        const tiles = [];
        async function text(value) {
          if (!value.trim()) return;
          for (let i = 0; i < [...value].length; i += 800) {
            tiles.push(
              await sharp({
                text: {
                  text: escape([...value].slice(i, i + 800).join("")),
                  font: "Noto Sans SC 42",
                  fontfile,
                  width: 1504,
                  rgba: true,
                  spacing: 12,
                },
              })
                .png()
                .toBuffer(),
            );
          }
        }
        async function formula(latex) {
          checkFormula(latex);
          const adaptor = liteAdaptor();
          RegisterHTMLHandler(adaptor);
          const doc = mathjax.document("", {
            InputJax: new TeX({
              packages: formulaPackages,
              maxBuffer: 10000,
              formatError: (_j, e) => {
                throw Error(e.message);
              },
            }),
            OutputJax: new SVG({ fontCache: "none" }),
          });
          let svg = adaptor.outerHTML(
            adaptor.firstChild(doc.convert(latex, { display: true })),
          );
          const view = svg
            .match(/viewBox="([^"]+)"/)[1]
            .split(" ")
            .map(Number);
          const h = 60,
            w = Math.max(1, Math.round((h * view[2]) / view[3]));
          svg = svg
            .replace(/width="[^"]+"/, `width="${w}"`)
            .replace(/height="[^"]+"/, `height="${h}"`);
          tiles.push(
            await sharp(Buffer.from(svg))
              .resize({ width: Math.min(w, 1504), height: 2200, fit: "inside" })
              .png()
              .toBuffer(),
          );
        }
        async function blocks(items) {
          for (const b of items) {
            if (b.type === "teacher-note") continue;
            if (b.type === "math") await formula(b.latex);
            else if (b.type === "image")
              tiles.push(
                await sharp(await bytes(b.fileId))
                  .resize({
                    width: 1504,
                    height: 2200,
                    fit: "inside",
                    withoutEnlargement: true,
                  })
                  .png()
                  .toBuffer(),
              );
            else if (b.runs) {
              let pending = "";
              for (const r of b.runs) {
                if (r.type === "text") pending += r.text;
                else {
                  await text(pending);
                  pending = "";
                  await formula(r.latex);
                }
              }
              await text(pending);
            } else if (b.type === "list") {
              for (const item of b.items) {
                await text(item.label);
                await blocks(item.blocks);
              }
            } else if (b.type === "table") {
              const cellWidth = Math.floor(1504 / b.rows[0].length);
              for (const row of b.rows) {
                const cells = [];
                let height = 48;
                for (const cell of row) {
                  const start = tiles.length;
                  await blocks(cell.blocks);
                  const parts = tiles.splice(start);
                  const overlays = [];
                  let y = 16;
                  for (const part of parts) {
                    const input = await sharp(part)
                      .resize({
                        width: cellWidth - 32,
                        height: 2100,
                        fit: "inside",
                        withoutEnlargement: true,
                      })
                      .png()
                      .toBuffer();
                    const m = await sharp(input).metadata();
                    overlays.push({ input, left: 16, top: y });
                    y += m.height + 12;
                  }
                  cells.push(overlays);
                  height = Math.max(height, y + 8);
                }
                if (height > 2200) throw Error("表格单行超过素材尺寸");
                const overlays = [];
                for (const [index, cell] of cells.entries()) {
                  for (const overlay of cell)
                    overlays.push({
                      ...overlay,
                      left: overlay.left + index * cellWidth,
                    });
                }
                const border = Buffer.from(
                  `<svg width="1504" height="${height}" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#777" stroke-width="1">${cells.map((_, i) => `<rect x="${i * cellWidth}" y="0" width="${cellWidth}" height="${height - 1}"/>`).join("")}</g></svg>`,
                );
                overlays.push({ input: border, left: 0, top: 0 });
                tiles.push(
                  await sharp({
                    create: {
                      width: 1504,
                      height,
                      channels: 4,
                      background: { r: 0, g: 0, b: 0, alpha: 0 },
                    },
                  })
                    .composite(overlays)
                    .png()
                    .toBuffer(),
                );
              }
            }
          }
        }
        if (task.options.mode === "figure-png")
          tiles.push(
            await sharp(await bytes(task.options.figureFileId))
              .resize({ width: 1504, height: 2200, fit: "inside" })
              .png()
              .toBuffer(),
          );
        else await blocks(task.question.body.blocks);
        const sections = [tiles.splice(0)];
        if (
          task.options.includeAnswers &&
          task.options.mode === "question-png"
        ) {
          await blocks(task.question.solution.blocks);
          if (tiles.length) sections.push(tiles.splice(0));
        }
        let index = 0;
        for (const section of sections) {
          let placed = [],
            top = 48;
          async function flush() {
            if (!placed.length) return;
            if (signal.aborted) return;
            const png = await sharp({
              create: {
                width: 1600,
                height: top + 24,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 },
              },
            })
              .composite(placed)
              .png()
              .toBuffer();
            const file = await files.store(
              p,
              {
                name: `题面-${++index}.png`,
                mediaType: "image/png",
                bytes: png,
              },
              {
                key: stableKey(job.id, index),
                method: "POST",
                path: "/questions/assets/" + job.id,
              },
            );
            output.push(file.id);
            placed = [];
            top = 48;
          }
          for (const input of section) {
            const meta = await sharp(input).metadata();
            // top includes the 20px gap after each tile, including the last.
            if (48 + meta.height + 20 + 24 > 2400)
              throw Error("单个内容块超过素材尺寸");
            if (top + meta.height + 20 + 24 > 2400) await flush();
            placed.push({ input, left: 48, top });
            top += meta.height + 20;
          }
          await flush();
        }
        if (signal.aborted)
          return { state: "failed", outputFileIds: [], issues: [] };
        if (!output.length) throw Error("无可输出题面");
        s.save("tasks", p, { ...task, outputFileIds: output });
        reportProgress({
          completed: output.length,
          total: output.length,
          unit: "stages",
        });
        return { state: "succeeded", outputFileIds: output, issues: [] };
      } catch (e) {
        return {
          state: "failed",
          outputFileIds: [],
          issues: [
            {
              code: "unsupported-formula",
              unitId: null,
              field: "/body",
              detail: "素材生成失败，请检查公式和配图。",
            },
          ],
        };
      }
    },
  };
}
