import fs from "node:fs/promises";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { BorderStyle, BuilderElement, Document, Paragraph, Packer, StringValueElement, TableProperties } from "docx";
import sharp from "sharp";
import { materialsError } from "../../workbench/jobs/index.js";

export const pandocDocument = (blocks) => ({
  "pandoc-api-version": [1, 23, 1, 2], meta: {}, blocks,
});
const attr = (pairs = []) => ["", [], pairs];
const text = (value) => String(value).split(/(\n)/).map((part) =>
  part === "\n" ? { t: "LineBreak" } : { t: "Str", c: part });
const math = (latex, display = false) => ({
  t: "Math", c: [{ t: display ? "DisplayMath" : "InlineMath" }, latex],
});
function command(directory) {
  const binary = process.env.MATERIALS_PANDOC_PATH || "/usr/bin/pandoc";
  const args = ["--die-with-parent", "--unshare-all", "--new-session",
    "--cap-drop", "ALL", "--clearenv", "--ro-bind", "/usr", "/usr",
    "--symlink", "usr/lib", "/lib", "--symlink", "usr/lib64", "/lib64",
    "--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp",
    "--ro-bind", path.resolve(binary), "/pandoc", "--setenv", "LANG", "C.UTF-8"];
  if (directory) args.push("--ro-bind", directory, "/input");
  args.push("/usr/bin/prlimit", "--as=1073741824", "--cpu=30", "--nofile=128", "--",
    "/pandoc", "--from=json", "--to=docx", "--standalone", "--fail-if-warnings");
  if (directory) args.push("--reference-doc=/input/reference.docx");
  return args;
}
function failure(stderr, status) {
  const error = materialsError("storage-unavailable", 503, "", "文档转换器不可用，请检查 Pandoc 配置后重新生成。");
  // Pandoc exits 3 on --fail-if-warnings; only a math warning is a user formula error.
  error.pandocFailure = true;
  error.formulaWarning = status === 3 && /Could not convert TeX math/.test(stderr);
  return error;
}
export function runPandocSync(document) {
  const result = spawnSync("/usr/bin/bwrap", command(), {
    input: JSON.stringify(document), timeout: 15000, maxBuffer: 32 * 1024 * 1024,
    env: {},
  });
  if (result.error || result.status !== 0)
    throw failure(String(result.stderr), result.status);
  return result.stdout;
}
function runPandoc(document, directory, signal) {
  return new Promise((resolve, reject) => {
    const child = spawn("/usr/bin/bwrap", command(directory), { env: {}, stdio: ["pipe", "pipe", "pipe"] });
    const chunks = []; let size = 0, stderr = "", stopped = false;
    const stop = () => { stopped = true; child.kill("SIGKILL"); };
    const timer = setTimeout(stop, 30000);
    signal?.addEventListener("abort", stop, { once: true });
    if (signal?.aborted) stop();
    child.stdout.on("data", (chunk) => {
      size += chunk.length;
      if (size > 64 * 1024 * 1024) stop();
      else chunks.push(chunk);
    });
    child.stderr.on("data", (chunk) => { if (stderr.length < 8000) stderr += chunk; });
    child.stdin.on("error", () => {});
    child.once("error", reject);
    child.once("close", (code) => {
      clearTimeout(timer); signal?.removeEventListener("abort", stop);
      if (code !== 0 || stopped) reject(failure(stderr, code));
      else resolve(Buffer.concat(chunks));
    });
    child.stdin.end(JSON.stringify(document));
  });
}
async function referenceDocument() {
  // docx supplies layout/styles only. Pandoc alone writes all document content,
  // formulas, relationships and packaging; no formula XML is imported or patched.
  const grid = { style: BorderStyle.SINGLE, size: 4, color: "666666" };
  const tableStyle = new BuilderElement({
    name: "w:style",
    attributes: { type: { key: "w:type", value: "table" }, id: { key: "w:styleId", value: "Table" } },
    children: [new StringValueElement("w:name", "Table"), new TableProperties({
      borders: Object.fromEntries(["top", "left", "bottom", "right", "insideHorizontal", "insideVertical"].map(edge => [edge, grid])),
      cellMargin: { top: 60, bottom: 60, left: 60, right: 60 },
    })],
  });
  return Packer.toBuffer(new Document({
    creator: "", title: "", description: "",
    styles: {
      importedStyles: [tableStyle],
      default: {
        document: { run: { font: "Noto Sans CJK SC", size: 22 },
          paragraph: { spacing: { line: 300, after: 120 }, widowControl: true } },
        ...Object.fromEntries([1, 2, 3].map(level => [`heading${level}`, {
          run: { bold: true, color: "000000", size: level === 1 ? 30 : 26 },
          paragraph: { keepNext: true, keepLines: true, spacing: { before: 180, after: 120 } },
        }])),
      },
      paragraphStyles: [
        // Pandoc resolves style inheritance from root styles. An explicit Normal
        // prevents it from treating the keep styles as missing and recreating them.
        { id: "Normal", name: "Normal" },
        { id: "BodyText", name: "Body Text", basedOn: "Normal", next: "BodyText" },
        // Pandoc uses both styles inside tables. Missing definitions make
        // LibreOffice flatten the cells when importing the generated DOCX.
        { id: "FirstParagraph", name: "First Paragraph", basedOn: "BodyText", next: "BodyText" },
        { id: "Compact", name: "Compact", basedOn: "BodyText", paragraph: { spacing: { before: 36, after: 36 } } },
        { id: "KeepNext", name: "Keep Next", basedOn: "BodyText", paragraph: { keepNext: true, keepLines: true } },
        { id: "KeepTogether", name: "Keep Together", basedOn: "BodyText", paragraph: { keepLines: true } },
      ],
      characterStyles: [{ id: "DefaultParagraphFont", name: "Default Paragraph Font" }],
    },
    sections: [{ properties: { page: {
      size: { width: 11906, height: 16838 },
      margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
    } }, children: [new Paragraph("")] }],
  }));
}
export async function generateDocx(blocks, { files, principal, signal }) {
  const directory = files.temporaryDirectory(principal, 'lesson-pandoc-');
  let imageIndex = 0;
  const inline = (runs) => runs.flatMap((run) => run.type === "math" ? [math(run.latex)] : text(run.text));
  const styled = (block, keepNext, together = false) => keepNext || together
    ? { t: "Div", c: [attr([["custom-style", keepNext ? "Keep Next" : "Keep Together"]]), [block]] } : block;
  async function render(items, keepLastNext = false) {
    const result = [];
    for (const [index, block] of items.entries()) {
      const keepNext = block.keepNext || (keepLastNext && index === items.length - 1);
      if (block.type === "paragraph" || block.type === "heading") {
        const content = inline(block.runs);
        result.push(block.type === "heading"
          ? { t: "Header", c: [block.level, attr(), content] }
          : styled({ t: "Para", c: content }, keepNext));
      } else if (block.type === "math") {
        result.push(styled({ t: "Para", c: [math(block.latex, true)] }, keepNext, true));
      } else if (block.type === "image") {
        const chunks = [];
        for await (const chunk of await files.open(principal, block.fileId)) chunks.push(chunk);
        const image = sharp(Buffer.concat(chunks), { limitInputPixels: 40000000 });
        const meta = await image.metadata();
        const scale = Math.min(block.widthMm * 96 / 25.4 / meta.width, (block.pageImage ? 870 : 650) / meta.height);
        const name = `image-${imageIndex++}.png`;
        await fs.writeFile(path.join(directory, name), await image.png().toBuffer());
        result.push(styled({ t: "Para", c: [{ t: "Image", c: [attr([
          ["width", `${meta.width * scale / 96}in`], ["height", `${meta.height * scale / 96}in`],
        ]), text(block.alt ?? ""), [`/input/${name}`, ""]] }] }, keepNext, true));
      } else if (block.type === "list") {
        for (const [i, item] of block.items.entries()) {
          const [first, ...rest] = item.blocks;
          const children = first?.type === "paragraph"
            ? [{ ...first, runs: [{ type: "text", text: item.label + " " }, ...first.runs] }, ...rest]
            : [{ type: "paragraph", runs: [{ type: "text", text: item.label }], keepNext: true }, ...item.blocks];
          result.push(...await render(children, keepNext && i === block.items.length - 1));
        }
      } else if (block.type === "table") {
        const rows = [];
        for (const [i, row] of block.rows.entries()) {
          const cells = [];
          for (const cell of row) cells.push([attr(), { t: "AlignDefault" }, 1, 1,
            await render(cell.blocks, keepNext && i === block.rows.length - 1)]);
          rows.push([attr(), cells]);
        }
        result.push({ t: "Table", c: [attr(), [null, []],
          // Use the available page width, rather than the writer's narrower
          // automatic grid, which can clip inline formulas in numeric tables.
          block.rows[0].map(() => [{ t: "AlignDefault" }, { t: "ColWidth", c: 1 / block.rows[0].length }]),
          [attr(), []], [[attr(), 0, [], rows]], [attr(), []]] });
      }
    }
    return result;
  }
  try {
    await fs.writeFile(path.join(directory, "reference.docx"), await referenceDocument());
    return await runPandoc(pandocDocument(await render(blocks)), directory, signal);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
}
