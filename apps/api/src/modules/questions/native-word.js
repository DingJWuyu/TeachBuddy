import { randomUUID } from "node:crypto";
import yauzl from "yauzl";
import { DOMParser } from "@xmldom/xmldom";
import { stableRequestKey } from "./request-key.js";
import { nativeText } from "./extraction.js";
import { normalizeMath } from "./native-math.js";
const local = (n) => n.localName ?? n.nodeName.split(":").at(-1);
const children = (n) =>
  Array.from(n.childNodes ?? []).filter((x) => x.nodeType === 1);
function latex(n, warnings = []) {
  const name = local(n),
    c = children(n),
    one = (k) => c.find((x) => local(x) === k),
    read = (k) => (one(k) ? latex(one(k), warnings) : "");
  if (name === "t") return n.textContent;
  if (name === "f") return `\\frac{${read("num")}}{${read("den")}}`;
  if (name === "rad")
    return `\\sqrt${read("deg") ? `[${read("deg")}]` : ""}{${read("e")}}`;
  if (name === "sSup") return `{${read("e")}}^{${read("sup")}}`;
  if (name === "sSub") return `{${read("e")}}_{${read("sub")}}`;
  if (name === "sSubSup")
    return `{${read("e")}}_{${read("sub")}}^{${read("sup")}}`;
  const readChildren = (nodes) => nodes.map((x) => latex(x, warnings));
  const property = (key, fallback) => {
    const node = one(name + "Pr");
    const setting = children(node ?? {}).find((x) => local(x) === key);
    return setting?.getAttribute("m:val") ?? fallback;
  };
  if (name === "eqArr")
    return `\\begin{aligned}${readChildren(c.filter((x) => local(x) === "e")).join("\\\\")}\\end{aligned}`;
  if (name === "m")
    return `\\begin{matrix}${c
      .filter((x) => local(x) === "mr")
      .map((row) =>
        readChildren(children(row).filter((x) => local(x) === "e")).join(" & "),
      )
      .join("\\\\")}\\end{matrix}`;
  if (name === "d") {
    const delimiter = (value) =>
      ({ "{": "\\{", "}": "\\}", "": "." })[value] ?? value;
    return `\\left${delimiter(property("begChr", "("))}${readChildren(c.filter((x) => local(x) === "e")).join(property("sepChr", "|"))}\\right${delimiter(property("endChr", ")"))}`;
  }
  if (name === "nary") {
    const symbol = property("chr", "∫"),
      command = {
        "∑": "\\sum",
        "∏": "\\prod",
        "∫": "\\int",
        "⋃": "\\bigcup",
        "⋂": "\\bigcap",
      }[symbol];
    if (!command) warnings.push(name);
    return `${command ?? symbol}${read("sub") ? `_{${read("sub")}}` : ""}${read("sup") ? `^{${read("sup")}}` : ""} ${read("e")}`;
  }
  if (name === "limLow" || name === "limUpp")
    return `\\${name === "limLow" ? "underset" : "overset"}{${read("lim")}}{${read("e")}}`;
  if (name === "func") return `${read("fName")} ${read("e")}`;
  if (name === "acc") {
    const command = {
      "̂": "hat",
      "̅": "bar",
      "⃗": "vec",
      "̃": "tilde",
      "̇": "dot",
      "̈": "ddot",
    }[property("chr", "̂")];
    if (!command) warnings.push(name);
    return command ? `\\${command}{${read("e")}}` : read("e");
  }
  if (name === "bar")
    return `\\${property("pos", "top") === "bot" ? "underline" : "overline"}{${read("e")}}`;
  if (name.endsWith("Pr")) return "";
  if (
    ![
      "oMath",
      "oMathPara",
      "r",
      "e",
      "num",
      "den",
      "deg",
      "sub",
      "sup",
      "lim",
      "fName",
    ].includes(name)
  )
    warnings.push(name);
  return readChildren(c).join("");
}
async function unzip(bytes) {
  return new Promise((resolve, reject) =>
    yauzl.fromBuffer(bytes, { lazyEntries: true }, (error, zip) => {
      if (error) return reject(error);
      const entries = new Map();
      let total = 0;
      zip.on("error", reject);
      zip.on("entry", (e) => {
        total += e.uncompressedSize;
        if (
          total > 512 * 1024 * 1024 ||
          e.fileName.includes("..") ||
          /vbaProject/i.test(e.fileName)
        ) {
          zip.close();
          reject(Error("不支持或超限的 Word 文件"));
          return;
        }
        if (
          !/^word\/(document.xml|_rels\/document.xml.rels|media\/)/.test(
            e.fileName,
          )
        ) {
          zip.readEntry();
          return;
        }
        zip.openReadStream(e, (err, stream) => {
          if (err) return reject(err);
          const chunks = [];
          stream.on("data", (x) => chunks.push(x));
          stream.on("error", reject);
          stream.on("end", () => {
            entries.set(e.fileName, Buffer.concat(chunks));
            zip.readEntry();
          });
        });
      });
      zip.on("end", () => resolve(entries));
      zip.readEntry();
    }),
  );
}
export function createWordReader(files) {
  return async (p, file) => {
    const chunks = [];
    for await (const b of await files.open(p, file.id)) chunks.push(b);
    const entries = await unzip(Buffer.concat(chunks));
    const parse = (bytes) => {
      const text = bytes?.toString("utf8") ?? "";
      if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw Error("外部 XML 定义不支持");
      return new DOMParser().parseFromString(text, "text/xml");
    };
    const doc = parse(entries.get("word/document.xml"));
    const rels = new Map();
    if (entries.has("word/_rels/document.xml.rels"))
      for (const n of Array.from(
        parse(entries.get("word/_rels/document.xml.rels")).getElementsByTagName(
          "Relationship",
        ),
      )) {
        if (n.getAttribute("TargetMode") === "External")
          throw Error("外部关系不支持");
        rels.set(n.getAttribute("Id"), n.getAttribute("Target"));
      }
    const paragraphs = Array.from(doc.getElementsByTagName("w:p"));
    const counts = [],
      records = [];
    let offset = 0;
    for (const [index, node] of paragraphs.entries()) {
      const blocks = [],
        runs = [];
      let runCount = 0,
        unsupported = false;
      async function visit(n) {
        const name = local(n);
        if (name === "oMath") {
          const warnings = [];
          runs.push({ type: "math", latex: normalizeMath(latex(n, warnings)) });
          if (warnings.length) unsupported = true;
          runCount++;
          return;
        }
        if (name === "r" && n.prefix === "w") {
          runCount++;
          for (const child of children(n)) {
            const kind = local(child);
            if (kind === "t") runs.push({ type: "text", text: child.textContent });
            else if (kind === "br" || kind === "cr") runs.push({ type: "text", text: "\n" });
            else if (kind === "tab") runs.push({ type: "text", text: "\t" });
          }
          return;
        }
        for (const child of children(n)) await visit(child);
      }
      await visit(node);
      for (const blip of Array.from(node.getElementsByTagName("a:blip"))) {
        const target = rels.get(blip.getAttribute("r:embed"));
        if (!target || target.includes("..")) continue;
        const bytes = entries.get("word/" + target);
        if (!bytes) continue;
        const extension = target.split(".").at(-1).toLowerCase();
        const mediaType = {
          png: "image/png",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          webp: "image/webp",
        }[extension];
        if (!mediaType) continue;
        const image = await files.store(
          p,
          { name: target.split("/").at(-1), mediaType, bytes },
          {
            key: stableRequestKey(file.id, target),
            method: "POST",
            path: "/questions/native-word-image",
          },
        );
        blocks.push({
          type: "image",
          fileId: image.id,
          alt: "原稿配图",
          widthMm: 100,
        });
      }
      counts.push(Math.max(1, runCount));
      if (runs.length) blocks.unshift({ type: "paragraph", runs });
      if (!blocks.length) continue;
      const text =
        runs.map((r) => r.text ?? `$${r.latex}$`).join("") ||
        (blocks.some((b) => b.type === "image") ? "\uFFFC" : "");
      const location = {
        kind: "docx",
        fileId: file.id,
        part: "word/document.xml",
        paragraph: index + 1,
        runStart: 0,
        runEnd: counts[index],
      };
      records.push({
        text,
        blocks,
        unsupported,
        location,
        start: offset,
        end: offset + [...text].length,
      });
      offset += [...text].length + 1;
    }
    const parsed = nativeText(records.map((r) => r.text).join("\n"));
    function mapped(locations) {
      return locations.flatMap((l) =>
        records
          .filter((r) => r.start < l.end && r.end >= l.start)
          .map((r) => r.location),
      );
    }
    for (const d of parsed.drafts) {
      for (const role of ["body", "solution"]) {
        const locations = d.parts
          .filter((part) => part.role === role)
          .flatMap((part) => part.locations);
        const rows = locations.flatMap((l) =>
          records.filter((r) => r.start < l.end && r.end >= l.start),
        );
        for (const row of rows) {
          if (row.unsupported)
            d.issues.push({
              id: randomUUID(),
              code: "uncertain-formula",
              field: "/" + role,
              locations: [{ kind: "text", start: row.start, end: row.end }],
              resolution: "open",
            });
          for (const block of row.blocks)
            if (block.type === "image") d[role].blocks.push(block);
        }
      }
      if (d.solution.blocks.length && d.answerStatus === "absent")
        d.answerStatus = "present";
      d.parts = d.parts.map((p) => ({ ...p, locations: mapped(p.locations) }));
      d.issues = d.issues
        .filter(
          (i) =>
            !(
              i.code === "missing-figure" &&
              d.body.blocks.some((b) => b.type === "image")
            ),
        )
        .map((i) => ({ ...i, locations: mapped(i.locations) }));
    }
    parsed.fragments = parsed.fragments.map((f) => ({
      ...f,
      locations: mapped(f.locations),
    }));
    const units = [
      {
        paragraph: 1,
        text: records.map((r) => r.text).join("\n"),
        result: parsed,
      },
    ];
    return { paragraphs: counts, units,
      original: records.map(row => ({
        paragraph: row.location.paragraph,
        document: {version: 2, blocks: structuredClone(row.blocks)},
        uncertain: row.unsupported,
      })),
    };
  };
}
