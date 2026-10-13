import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import sharp from "sharp";
import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import "mathjax-full/js/input/tex/ams/AmsConfiguration.js";
import { checkFormula, formulaPackages } from "../../../../../packages/shared/src/math/formula.js";

const require = createRequire(import.meta.url);
const fontfile = require.resolve("@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.woff");
const escape = value => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const width = 1504;
const maxHeight = 2328;

// This renderer belongs to question assets: the browser lays out each complete
// paragraph, then PNG cuts follow blocks or actual lines, never source lengths.
export async function renderQuestionPng(sections, { bytes, signal }) {
  const adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);
  const math = mathjax.document("", {
    InputJax: new TeX({
      packages: formulaPackages, maxBuffer: 10000,
      formatError: (_jax, error) => { throw Error(error.message); },
    }),
    OutputJax: new SVG({ fontCache: "none" }),
  });
  function formula(latex, display = false) {
    checkFormula(latex);
    const node = math.convert(latex, { display, em: 42, ex: 21 });
    const svg = adaptor.outerHTML(adaptor.firstChild(node));
    if (/data-mjx-error|<merror/.test(svg)) throw Error("公式无法排版");
    return `<span class="${display ? "display-math" : "inline-math"}">${svg}</span>`;
  }
  const images = new Map();
  async function image(fileId) {
    if (!images.has(fileId)) {
      const png = await sharp(await bytes(fileId)).rotate()
        .resize({ width, height: 2200, fit: "inside", withoutEnlargement: true }).png().toBuffer();
      images.set(fileId, `data:image/png;base64,${png.toString("base64")}`);
    }
    return `<img src="${images.get(fileId)}" alt="">`;
  }
  async function blocks(items) {
    const result = [];
    for (const block of items) {
      if (block.type === "teacher-note") continue;
      if (block.runs) {
        const runs = block.runs.map(run => run.type === "text" ? escape(run.text) : formula(run.latex)).join("");
        result.push(`<div class="paragraph">${runs || "<br>"}</div>`);
      } else if (block.type === "math") result.push(`<div class="formula">${formula(block.latex, true)}</div>`);
      else if (block.type === "image") result.push(`<div class="figure">${await image(block.fileId)}</div>`);
      else if (block.type === "list") {
        const rows = [];
        for (const item of block.items) rows.push(`<div class="list-item"><div class="label">${escape(item.label)}</div><div>${await blocks(item.blocks)}</div></div>`);
        result.push(`<div class="list">${rows.join("")}</div>`);
      } else if (block.type === "table") {
        const rows = [];
        for (const row of block.rows) {
          const cells = [];
          for (const cell of row) cells.push(`<td>${await blocks(cell.blocks)}</td>`);
          rows.push(`<tr>${cells.join("")}</tr>`);
        }
        result.push(`<table><tbody>${rows.join("")}</tbody></table>`);
      }
    }
    return result.join("");
  }
  const rendered = [];
  for (const section of sections) rendered.push(await blocks(section));
  const font = (await readFile(fontfile)).toString("base64");
  let browser;
  let deadline;
  const stop = () => { browser?.close().catch(() => {}); };
  try {
    signal.throwIfAborted();
    browser = await chromium.launch({ headless: true, timeout: 10000 });
    signal.addEventListener("abort", stop, { once: true });
    deadline = setTimeout(stop, 30000);
    const context = await browser.newContext({ viewport: { width: 1600, height: 2400 }, deviceScaleFactor: 1, serviceWorkers: "block" });
    // Only generated markup and embedded fonts/images are rendered, without
    // cookies, scripts, network access or imported HTML.
    await context.route("**/*", route => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const output = [];
    for (const html of rendered) {
      if (!html) continue;
      signal.throwIfAborted();
      await page.setContent(`<!doctype html><meta charset="utf-8"><style>
        @font-face{font-family:QuestionText;src:url(data:font/woff;base64,${font}) format('woff')}
        html,body{margin:0;background:transparent;color:#111}
        #content{width:${width}px;padding-bottom:20px;font:42px/1.65 QuestionText,'Noto Sans SC',sans-serif;overflow-wrap:anywhere;display:flow-root}
        .paragraph{white-space:pre-wrap;margin:0 0 20px}
        .inline-math{display:inline-block;white-space:nowrap;max-width:100%;line-height:normal}
        svg{max-width:100%;height:auto;overflow:visible}
        .formula{margin:0 0 20px}.display-math{display:block;max-width:100%;line-height:normal}.display-math svg{display:block}
        .figure{margin:0 0 20px}img{display:block;max-width:100%;max-height:2200px;object-fit:contain}
        .list-item{display:grid;grid-template-columns:max-content minmax(0,1fr);column-gap:16px}.label{white-space:nowrap}
        table{border-collapse:collapse;table-layout:fixed;width:100%;margin:0 0 20px}td{border:1px solid #777;padding:16px;vertical-align:top}td .paragraph:last-child{margin-bottom:0}
        #content>:last-child{margin-bottom:0}
      </style><div id="content">${html}</div>`);
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map(img => img.decode()));
        for (const svg of document.querySelectorAll("svg")) {
          const rect = svg.getBoundingClientRect();
          const available = svg.closest("td")?.clientWidth - 32 || 1504;
          const scale = Math.min(1, available / rect.width, 2200 / rect.height);
          if (scale < 1) {
            svg.style.width = `${rect.width * scale}px`;
            svg.style.height = `${rect.height * scale}px`;
            const alignment = svg.style.verticalAlign.match(/^(-?[\d.]+)(ex|em|px)$/);
            if (alignment) svg.style.verticalAlign = `${Number(alignment[1]) * scale}${alignment[2]}`;
          }
        }
      });
      const slices = await page.evaluate(maximum => {
        const content = document.getElementById("content");
        const total = Math.ceil(content.getBoundingClientRect().height);
        const protectedLines = [];
        const add = rect => {
          if (rect.height && rect.width) protectedLines.push({ start: Math.floor(rect.top), end: Math.ceil(rect.bottom) });
        };
        const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          if (walker.currentNode.parentElement.closest("svg")) continue;
          const range = document.createRange();
          range.selectNodeContents(walker.currentNode);
          for (const rect of range.getClientRects()) add(rect);
        }
        for (const element of content.querySelectorAll("img,svg")) add(element.getBoundingClientRect());
        // Keep the final visible line/image together with its trailing spacing,
        // so a one-pixel overflow never produces an empty final PNG.
        const last = protectedLines.toSorted((a, b) => a.end - b.end).at(-1);
        if (last) protectedLines.push({ start: last.start, end: total });
        const blocks = [...content.children, ...content.querySelectorAll("tr,.list-item")]
          .map(element => Math.ceil(element.getBoundingClientRect().bottom)).sort((a, b) => a - b);
        const cuts = [];
        let start = 0;
        while (start < total) {
          let end = Math.min(start + maximum, total);
          if (end < total) {
            const boundary = blocks.filter(bottom => bottom > start && bottom <= end).at(-1);
            if (boundary !== undefined) end = boundary;
            let crossing;
            while ((crossing = protectedLines.find(line => line.start < end && line.end > end))) end = crossing.start;
          }
          if (end <= start) throw Error("单个公式或图像超过分片尺寸");
          cuts.push({ top: start, height: end - start });
          start = end;
        }
        return cuts;
      }, maxHeight);
      for (const slice of slices) {
        signal.throwIfAborted();
        const png = await page.screenshot({ fullPage: true, clip: { x: 0, y: slice.top, width, height: slice.height }, omitBackground: true, animations: "disabled" });
        output.push(await sharp(png).extend({ top: 48, bottom: 24, left: 48, right: 48, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer());
      }
    }
    return output;
  } finally {
    clearTimeout(deadline);
    signal.removeEventListener("abort", stop);
    await browser?.close();
  }
}
