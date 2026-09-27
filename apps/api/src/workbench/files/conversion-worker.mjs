// Runs only inside the restricted conversion process, never in the API process.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import yauzl from "yauzl";
import { DOMParser } from "@xmldom/xmldom";
const [mime, mode] = process.argv.slice(2);
const input = "/input/source";
const maxExpanded = 512 * 1024 * 1024;
async function inspectZip() {
  await new Promise((resolve, reject) =>
    yauzl.open(input, { lazyEntries: true }, (error, zip) => {
      if (error) return reject(error);
      let expanded = 0,
        count = 0;
      const fail = (error) => {
        zip.close();
        reject(error);
      };
      zip.on("error", fail);
      zip.on("end", resolve);
      zip.on("entry", (entry) => {
        expanded += entry.uncompressedSize;
        if (
          ++count > 20000 ||
          expanded > maxExpanded ||
          /(?:vbaProject\.bin|\/externalLinks\/)/i.test(entry.fileName)
        )
          return fail(new Error("Unsafe or excessive archive"));
        if (entry.fileName.endsWith("/")) return zip.readEntry();
        zip.openReadStream(entry, (error, stream) => {
          if (error) return fail(error);
          let actual = 0;
          const parts = [];
          stream.on("data", (chunk) => {
            actual += chunk.length;
            if (actual > entry.uncompressedSize || actual > maxExpanded) {
              stream.destroy();
              fail(new Error("Expanded size exceeded"));
            }
            if (/\.rels$/i.test(entry.fileName)) parts.push(chunk);
          });
          stream.on("error", fail);
          stream.on("end", () => {
            if (parts.length) {
              try {
                const xml = Buffer.concat(parts).toString();
                if (/<!DOCTYPE|<!ENTITY/i.test(xml))
                  throw new Error("Unsupported relationship XML");
                const document = new DOMParser().parseFromString(xml, "application/xml");
                for (const relationship of Array.from(document.getElementsByTagNameNS("*", "Relationship"))) {
                  if (relationship.getAttribute("TargetMode") !== "External") continue;
                  // A normal hyperlink is not a fetched document dependency.
                  // Conversion remains offline; linked images/objects stay rejected.
                  const type = relationship.getAttribute("Type");
                  const target = relationship.getAttribute("Target");
                  if (![
                    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink",
                    "http://purl.oclc.org/ooxml/officeDocument/relationships/hyperlink",
                  ].includes(type) || !/^https?:\/\//i.test(target))
                    throw new Error("External relationship");
                }
              } catch (error) {
                return fail(error);
              }
            }
            zip.readEntry();
          });
        });
      });
      zip.readEntry();
    }),
  );
}
const office = new Map([
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "docx",
  ],
  [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "pptx",
  ],
  ["application/msword", "doc"],
  ["application/vnd.ms-powerpoint", "ppt"],
  ["application/x-cfb", "doc"],
]);
let pdf = input;
let legacy = false;
// Resource search reuses Poppler inside the same offline, bounded sandbox.
// Text extraction is independent of page-image conversion and never changes it.
if (mode === "text") {
  if (mime !== "application/pdf") throw new Error("Text extraction requires PDF");
  const text = execFileSync("/usr/bin/pdftotext", ["-enc", "UTF-8", input, "-"], {
    encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: 10000,
  });
  const pages = text.split("\f");
  if (!pages.at(-1)?.trim()) pages.pop();
  if (pages.length > 500) throw new Error("Page limit exceeded");
  fs.writeFileSync("/output/result.json", JSON.stringify({ pages: [], textPages: pages, pdf: null }));
  process.exit(0);
}
if (office.has(mime)) {
  const ext = office.get(mime);
  legacy = ext === "doc";
  if (ext.endsWith("x")) await inspectZip();
  fs.mkdirSync("/output/profile/user", { recursive: true });
  fs.writeFileSync(
    "/output/profile/user/registrymodifications.xcu",
    `<?xml version="1.0"?><oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item><item oor:path="/org.openoffice.Office.Common/Load"><prop oor:name="UpdateDocMode" oor:op="fuse"><value>0</value></prop></item></oor:items>`,
  );
  fs.copyFileSync(input, `/output/source.${ext}`);
  execFileSync(
    "/office/program/soffice",
    [
      "-env:UserInstallation=file:///output/profile",
      "--headless",
      "--nologo",
      "--nodefault",
      "--nolockcheck",
      "--norestore",
      "--convert-to",
      "pdf",
      "--outdir",
      "/output",
      `/output/source.${ext}`,
    ],
    { timeout: 110000, stdio: "pipe", maxBuffer: 1024 * 1024 },
  );
  pdf = "/output/source.pdf";
}
let pages = [];
let issues = [];
if (mime === "text/html") {
  const text = fs.readFileSync(input, "utf8");
  if (text.length > 4000) issues.push("missing-page");
  const escaped = text
    .slice(0, 4000)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  await sharp({
    text: { text: escaped, font: "monospace 18", width: 1400, rgba: true },
  })
    .flatten({ background: "#fff" })
    .png()
    .toFile("/output/page-1.png");
  const { width, height } = await sharp("/output/page-1.png").metadata();
  pages.push({ page: 1, width, height, name: "page-1.png" });
} else if (mime.startsWith("image/")) {
  const image = sharp(input, { limitInputPixels: 40000000 }).rotate();
  await image.png().toFile("/output/page-1.png");
  const { width, height } = await sharp("/output/page-1.png").metadata();
  pages.push({ page: 1, width, height, name: "page-1.png" });
} else {
  const info = execFileSync("/usr/bin/pdfinfo", [pdf], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  const count = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
  if (!count || count > 500) throw new Error("Page limit exceeded");
  if (fs.statSync(pdf).size > 100 * 1024 * 1024)
    throw new Error("PDF size limit exceeded");
  let outputBytes = 0;
  for (let page = 1; page <= count; page++) {
    execFileSync(
      "/usr/bin/pdftoppm",
      [
        "-f",
        String(page),
        "-l",
        String(page),
        "-singlefile",
        "-scale-to",
        "2400",
        "-png",
        pdf,
        `/output/page-${page}`,
      ],
      { stdio: "pipe", maxBuffer: 1024 * 1024 },
    );
    outputBytes += fs.statSync(`/output/page-${page}.png`).size;
    if (outputBytes > maxExpanded)
      throw new Error("Output size limit exceeded");
    const { width, height } = await sharp(`/output/page-${page}.png`, {
      limitInputPixels: 40000000,
    }).metadata();
    pages.push({ page, width, height, name: `page-${page}.png` });
  }
}
fs.writeFileSync(
  "/output/result.json",
  JSON.stringify({
    pages,
    pdf: pdf === "/output/source.pdf" ? "source.pdf" : null,
    legacy,
    issues,
  }),
);
