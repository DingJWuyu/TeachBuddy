import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DOMParser } from "@xmldom/xmldom";
import sharp from "sharp";
import { nativeText } from './extraction.js';
import { documentText } from './materials-content.js';
import { extractionId } from "./extraction-fragments.js";
import { convertFile } from '../../workbench/files/converter.js';
const execute = promisify(execFile);
const normalize = (s) => s.trim().replace(/[.．、:：]\s*$/, "");
const compact = text => text.normalize('NFKC').replace(/\s/g, '');

// Resolve a Poppler text box to a complete, unique set of PDF.js text items.
// Missing font glyphs contribute their real footprint, never invented text.
function matchingText(text, items, tolerance) {
  const candidates = items.filter(item => item.text.replaceAll('\0', '').trim()
    && item.y < text.y + text.height && item.y + item.height > text.y
    && item.x >= text.x - tolerance && item.x < text.x + text.width + tolerance);
  if (candidates.length > 128) return [];
  const matches = [];
  let budget = 256;
  function match(remaining, right, selected) {
    if (--budget < 0) return;
    if (matches.length > 1) return;
    if (!remaining) { matches.push(selected); return; }
    for (const item of candidates) {
      if (selected.includes(item) || Math.abs(item.x - right) > tolerance) continue;
      const value = compact(item.text.replaceAll('\0', ''));
      if (value && remaining.startsWith(value)) match(remaining.slice(value.length), item.x + item.width, [...selected, item]);
    }
  }
  match(compact(text.text.replaceAll('\0', '')), text.x, []);
  return budget >= 0 && matches.length === 1 ? matches[0] : [];
}

function figureMembership(textBoxes, items, tolerance) {
  const evidence = new Map(textBoxes.map(text => [text, new Set()]));
  for (const text of textBoxes) {
    for (const item of matchingText(text, items, tolerance)) evidence.get(text).add(item.figure);
  }
  // The two engines may split one font run differently (e.g. angle + A=).
  // Require the whole run in the reverse direction as well, never substrings.
  for (const item of items) {
    for (const text of matchingText(item, textBoxes, tolerance)) evidence.get(text).add(item.figure);
  }
  return new Map([...evidence].map(([text, owners]) => [text, owners.size === 1 ? [...owners][0] : null]));
}
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
    .map((b) => ({ink: b, crop: [
      Math.max(0, b[0] - length),
      Math.max(0, b[1] - length),
      Math.min(width, b[2] + length),
      Math.min(height, b[3] + length),
    ]}));
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
    const pdfBytes = await bytes(files, principal, unit.preview.renditionFileId);
    await fs.writeFile(
      path.join(work, "source.pdf"),
      pdfBytes,
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
    if (!detected.length) return;
    let structure = null;
    try {
      ({structure} = await convertFile({bytes: pdfBytes, mediaType: 'application/pdf',
        directory: work, structurePage: unit.page, timeoutMs: 25000, signal}));
    } catch {
      signal.throwIfAborted();
      // Optional structural evidence must never make the native text disappear.
      for (const q of questions) q.doubts.push('配图结构读取失败，图边文字保留待核对');
    }
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
        ({crop: b}) =>
          b[1] / info.height > anchor.y && b[3] / info.height < (next?.y ?? 1),
      );
      // Multiple regions may be separate diagrams or formula strokes. Leave ambiguous.
      if (candidates.length !== 1 || !/如图|[配附].{0,20}图|图示|正方体|长方体|三角形|棱[锥柱]/.test(q.text))
        continue;
      const {ink, crop} = candidates[0];
      const [x, y, right, bottom] = crop;
      const geometry = {x: ink[0] / info.width, y: ink[1] / info.height,
        right: ink[2] / info.width, bottom: ink[3] / info.height};
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
      const textBoxes = Array.from(page.getElementsByTagName('text')).map(node => ({
        text: node.textContent.normalize('NFKC').replace(/\s/g, ''),
        x: Number(node.getAttribute('left')) / pw, y: Number(node.getAttribute('top')) / ph,
        width: Number(node.getAttribute('width')) / pw, height: Number(node.getAttribute('height')) / ph,
      }));
      // Xpdf may join vertices on different baselines into one line (for
      // example A₁ D₁). Match the entire original text to Poppler's fragments;
      // a page-wide horizontal band is not that line's footprint.
      const matchedLines = (q.nativeLines ?? []).map(line => {
        let remaining = line.text.normalize('NFKC').replace(/\s/g, '');
        const boxes = [];
        // Both tools round page coordinates to integer pixels independently.
        const candidates = textBoxes.filter(text => text.text
          && text.y < line.y + line.height + 2 / ph && text.y + text.height > line.y - 2 / ph
          && text.x + text.width >= line.x - 2 / pw)
          .sort((a, b) => a.x - b.x || a.y - b.y);
        for (const text of candidates) {
          if (!remaining.startsWith(text.text)) continue;
          boxes.push(text);
          remaining = remaining.slice(text.text.length);
          if (!remaining) break;
        }
        return {line, boxes: !remaining && boxes.length
          && Math.abs(boxes[0].x - line.x) <= 2 / pw ? boxes : []};
      });
      const initial = location.box;
      const insideGeometry = text => text.x >= geometry.x && text.x + text.width <= geometry.right
        && text.y >= geometry.y && text.y + text.height <= geometry.bottom;
      const crossesGeometry = text => text.x + text.width >= geometry.x
        && text.x <= geometry.right && text.y + text.height >= geometry.y && text.y <= geometry.bottom;
      const withinLabelMargin = text => text.x + text.width / 2 >= initial.x
        && text.x + text.width / 2 <= initial.x + initial.width
        && text.y + text.height / 2 >= initial.y
        && text.y + text.height / 2 <= initial.y + initial.height;
      const matched = matchedLines.filter(({boxes}) => boxes.length
        && withinLabelMargin(boxes[0])
        && boxes.every(text => text.x < initial.x + initial.width && text.x + text.width > initial.x
          && matchedLines.filter(other => other.boxes.includes(text)).length === 1));
      // Structural membership can prove exterior labels. Without it, crossing
      // text may complete a crop but only strict interior text can be removed.
      let members = [];
      let cropLines, adopted;
      if (structure?.tagged) {
        const groups = Array.from({length: structure.figures}, (_, figure) => {
          const items = structure.items.filter(item => item.figure === figure);
          const x = Math.min(...items.map(item => item.x)), y = Math.min(...items.map(item => item.y));
          return {figure, items, x, y, width: Math.max(...items.map(item => item.x + item.width)) - x,
            height: Math.max(...items.map(item => item.y + item.height)) - y};
        });
        const owners = groups.filter(group => group.items.length
          && group.items.every(item => item.y >= anchor.y && item.y + item.height <= (next?.y ?? 1))
          && detected.filter(({ink: b}) => group.x < b[2] / info.width
            && group.x + group.width > b[0] / info.width && group.y < b[3] / info.height
            && group.y + group.height > b[1] / info.height).length === 1
          && crossesGeometry(group));
        const owner = owners.length === 1 ? owners[0] : null;
        members = owner?.items ?? [];
        const belongs = figureMembership(textBoxes, structure.items, 2 / pw);
        adopted = owner ? matchedLines.filter(({boxes}) => boxes.length
          && boxes.every(text => belongs.get(text) === owner.figure
            && matchedLines.filter(other => other.boxes.includes(text)).length === 1)) : [];
        cropLines = adopted;
        if (!owner) q.doubts.push('配图结构归属不明确，文字保留待核对');
      } else {
        cropLines = matched.filter(({boxes}) => boxes.some(crossesGeometry));
        adopted = cropLines.filter(({line, boxes}) => !/[\p{Script=Han}。！？!?]/u.test(line.text)
          && boxes.every(insideGeometry));
      }
      if (matched.some(item => !adopted.includes(item)))
        q.doubts.push('图边文字保留为可编辑内容，请核对与配图的归属');
      const labels = [...members, ...cropLines.flatMap(({boxes}) => boxes)];
      if (labels.length) {
        const left = Math.min(initial.x, ...labels.map(text => text.x));
        const top = Math.min(initial.y, ...labels.map(text => text.y));
        const right = Math.max(initial.x + initial.width, ...labels.map(text => text.x + text.width));
        const bottom = Math.max(initial.y + initial.height, ...labels.map(text => text.y + text.height));
        // A fragment crossing another question is ambiguous; keep the original.
        if (top >= anchor.y && bottom <= (next?.y ?? 1))
          location.box = {x: left, y: top, width: right - left, height: bottom - top};
        else { adopted.length = 0; cropLines.length = 0; }
      }
      // Display padding may include a neighbouring editable line. Clip only
      // that padding; the real strokes and adopted labels remain untouched.
      const included = new Set(cropLines.flatMap(({boxes}) => boxes));
      const content = {x: Math.min(geometry.x, ...labels.map(t => t.x)),
        y: Math.min(geometry.y, ...labels.map(t => t.y)),
        right: Math.max(geometry.right, ...labels.map(t => t.x + t.width)),
        bottom: Math.max(geometry.bottom, ...labels.map(t => t.y + t.height))};
      let {x: left, y: top, width, height} = location.box;
      let cropRight = left + width, cropBottom = top + height;
      for (const text of textBoxes.filter(t => t.text && !included.has(t))) {
        if (text.x >= cropRight || text.x + text.width <= left || text.y >= cropBottom || text.y + text.height <= top) continue;
        if (text.y >= content.bottom) cropBottom = Math.min(cropBottom, text.y);
        else if (text.y + text.height <= content.y) top = Math.max(top, text.y + text.height);
        if (text.x >= content.right) cropRight = Math.min(cropRight, text.x);
        else if (text.x + text.width <= content.x) left = Math.max(left, text.x + text.width);
      }
      // A rectangular crop can also enclose unrelated text between its proven
      // labels. If padding cannot exclude it, show the whole original glyphs
      // and retain the editable source; crop coverage never grants membership.
      const overlaps = text => text.x < cropRight && text.x + text.width > left
        && text.y < cropBottom && text.y + text.height > top;
      const retained = textBoxes.filter(text => text.text && !included.has(text) && overlaps(text));
      left = Math.min(left, ...retained.map(text => text.x));
      top = Math.min(top, ...retained.map(text => text.y));
      cropRight = Math.max(cropRight, ...retained.map(text => text.x + text.width));
      cropBottom = Math.max(cropBottom, ...retained.map(text => text.y + text.height));
      // Expand once only. Crossing a question/page or touching further text is
      // ambiguous, so leave the entire figure for review instead of cascading.
      if (![left, top, cropRight, cropBottom].every(Number.isFinite)
        || left < 0 || top < 0 || cropRight > 1 || cropBottom > 1
        || cropRight <= left || cropBottom <= top || top < anchor.y || cropBottom > (next?.y ?? 1)
        || textBoxes.some(text => text.text && !included.has(text) && !retained.includes(text) && overlaps(text))) {
        q.doubts.push('配图与邻近内容交叠，保留原稿待手动校对');
        continue;
      }
      if (retained.length) q.doubts.push('裁图包含附近正文，请对照原稿核对；正文仍可编辑');
      location.box = {x: left, y: top, width: cropRight - left, height: cropBottom - top};
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
      if (adopted.length) {
        const removed = new Set(adopted.map(({line}) => line));
        const cleaned = nativeText(q.nativeLines.filter(line => !removed.has(line)).map(line => line.text).join('\n')).drafts;
        if (cleaned.length === 1 && normalize(cleaned[0].title) === normalize(q.label)) {
          q.document = cleaned[0].body;
          q.text = documentText(q.document);
        }
      }
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
