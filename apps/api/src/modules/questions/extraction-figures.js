import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DOMParser } from "@xmldom/xmldom";
import sharp from "sharp";
import { extractionId } from "./extraction-fragments.js";
const execute = promisify(execFile);
const normalize = (s) => s.trim().replace(/[.．、:：]\s*$/, "");
async function bytes(files, p, id) {
  const chunks = [];
  for await (const chunk of await files.open(p, id)) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// The previously verified long-stroke detector, applied to this rendition's
// pixels. A region alone is never evidence of its question ownership.
function regions(pixels, width, height) {
  const length = Math.max(25, Math.floor(Math.min(width, height) * 0.025));
  const lines = [];
  for (let y = 0; y < height; y++) {
    let start = -1;
    for (let x = 0; x <= width; x++) {
      if (x < width && pixels[y * width + x] < 185) {
        if (start < 0) start = x;
      } else if (start >= 0) {
        if (x - start >= length) lines.push([start, y, x, y + 1]);
        start = -1;
      }
    }
  }
  for (let x = 0; x < width; x++) {
    let start = -1;
    for (let y = 0; y <= height; y++) {
      if (y < height && pixels[y * width + x] < 185) {
        if (start < 0) start = y;
      } else if (start >= 0) {
        if (y - start >= length) lines.push([x, start, x + 1, y]);
        start = -1;
      }
    }
  }
  if (lines.length > 10000) return [];
  const groups = [],
    pad = Math.max(5, length / 2);
  for (const line of lines) {
    let box = line;
    for (let i = 0; i < groups.length; ) {
      const b = groups[i];
      if (
        box[0] <= b[2] + pad &&
        box[2] >= b[0] - pad &&
        box[1] <= b[3] + pad &&
        box[3] >= b[1] - pad
      ) {
        box = [
          Math.min(box[0], b[0]),
          Math.min(box[1], b[1]),
          Math.max(box[2], b[2]),
          Math.max(box[3], b[3]),
        ];
        groups.splice(i, 1);
        i = 0;
      } else i++;
    }
    groups.push(box);
  }
  return groups
    .filter(
      (b) =>
        b[2] - b[0] > width * 0.09 &&
        b[3] - b[1] > height * 0.035 &&
        b[2] - b[0] < width * 0.85 &&
        b[3] - b[1] < height * 0.65,
    )
    .map((b) => [
      Math.max(0, b[0] - length),
      Math.max(0, b[1] - length),
      Math.min(width, b[2] + length),
      Math.min(height, b[3] + length),
    ]);
}

export async function locateFigures({
  files,
  principal,
  unit,
  result,
  signal,
}) {
  const records = result.records ?? [];
  const questions = records.filter((r) => r.role === "question");
  if (!questions.length || files.read(principal, unit.preview.renditionFileId).mediaType !== "application/pdf") return;
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "questions-layout-"));
  try {
    await fs.writeFile(
      path.join(work, "source.pdf"),
      await bytes(files, principal, unit.preview.renditionFileId),
    );
    // Same Poppler installation as preview; parsing has no network or host write access.
    const { stdout } = await execute(
      "/usr/bin/bwrap",
      [
        "--die-with-parent",
        "--unshare-all",
        "--cap-drop",
        "ALL",
        "--clearenv",
        "--ro-bind",
        "/usr",
        "/usr",
        "--symlink",
        "usr/lib",
        "/lib",
        "--symlink",
        "usr/lib64",
        "/lib64",
        "--proc",
        "/proc",
        "--dev",
        "/dev",
        "--tmpfs",
        "/tmp",
        "--ro-bind",
        work,
        "/input",
        "/usr/bin/prlimit",
        "--as=1073741824",
        "--cpu=20",
        "--fsize=16777216",
        "--",
        "/usr/bin/pdftohtml",
        "-xml",
        "-stdout",
        "-i",
        "-f",
        String(unit.page),
        "-l",
        String(unit.page),
        "/input/source.pdf",
        "/tmp/page",
      ],
      { timeout: 25000, maxBuffer: 8 * 1024 * 1024, signal },
    );
    const xml = new DOMParser().parseFromString(stdout, "text/xml");
    const page = xml.getElementsByTagName("page")[0];
    if (!page) return;
    const pw = Number(page.getAttribute("width")),
      ph = Number(page.getAttribute("height"));
    const anchors = [...Array.from(page.getElementsByTagName("text"))].flatMap(
      (node) => {
        const match = node.textContent.match(
          /^\s*((?:Q\s*)?\d+[.．、]|例\s*\d+[:：.、]?|练习\s*\d+[:：.、]?)/i,
        );
        return match
          ? [
              {
                label: normalize(match[1]),
                y: Number(node.getAttribute("top")) / ph,
                x: Number(node.getAttribute("left")) / pw,
              },
            ]
          : [];
      },
    );
    // The vertical ownership rule is only proven for one column. Different
    // horizontal anchor positions leave figure ownership for human review.
    if (
      anchors.length &&
      Math.max(...anchors.map((a) => a.x)) -
        Math.min(...anchors.map((a) => a.x)) >
        0.12
    )
      return;
    const sourcePage = unit.preview.pages.find((p) => p.page === unit.page);
    const { data, info } = await sharp(
      await bytes(files, principal, sourcePage.imageFileId),
    )
      .resize({
        width: 1400,
        height: 1400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const detected = regions(data, info.width, info.height);
    for (const q of questions) {
      const own = anchors.filter((a) => a.label === normalize(q.label));
      if (
        own.length !== 1 ||
        questions.filter((x) => normalize(x.label) === normalize(q.label))
          .length !== 1
      )
        continue;
      const anchor = own[0];
      const next = anchors
        .filter((a) => a.y > anchor.y)
        .sort((a, b) => a.y - b.y)[0];
      const candidates = detected.filter(
        (b) =>
          b[1] / info.height > anchor.y && b[3] / info.height < (next?.y ?? 1),
      );
      // Multiple regions may be separate diagrams or formula strokes. Leave ambiguous.
      if (candidates.length !== 1 || !/如图|[配附].{0,20}图|图示|正方体|长方体|三角形|棱[锥柱]/.test(q.text))
        continue;
      const [x, y, right, bottom] = candidates[0];
      const preceding = anchors.filter((a) => a.y < y / info.height);
      const nearestY = Math.max(...preceding.map((a) => a.y));
      if (preceding.filter((a) => a.y === nearestY).length !== 1) continue;
      const location = {
        ...unit.location,
        box: {
          x: x / info.width,
          y: y / info.height,
          width: (right - x) / info.width,
          height: (bottom - y) / info.height,
        },
      };
      signal.throwIfAborted();
      const file = await files.crop(
        principal,
        { location },
        {
          key: extractionId(q.id, "figure", location),
          method: "POST",
          path: "/internal/questions/figures",
        },
      );
      q.figure = {
        fileId: file.id,
        location,
        sourceSha256: unit.file.sha256,
        renditionSha256: files.read(principal, sourcePage.imageFileId).sha256,
        anchor,
      };
    }
  } finally {
    await fs.rm(work, { recursive: true, force: true });
  }
}
