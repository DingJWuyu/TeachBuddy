import { nativeText, questionStart, answerHeading, continuationHeading } from "./extraction.js";
import { extractionId, questionLabel } from "./extraction-fragments.js";
import { documentText, images } from "./materials-content.js";

const length = text => [...text].length;
const slice = (text, start, end) => [...text].slice(start, end).join("");
const paragraphText = block => (block.runs ?? []).map(run =>
  run.type === "math" ? run.latex.replace(/[\r\n]/g, " ") : run.text).join("");
const pageHeading = text => text.replace(/^\s*第\s*\d+\s*页\s*[·:：-]?\s*/, "");
const uniqueLocations = entries => [...new Map(entries.map(entry =>
  [JSON.stringify(entry.location), entry.location])).values()];

function numberedBlocks(block) {
  if (block.type !== "list" || block.role !== "plain" ||
      !block.items.every(item => /^\d+[.)]$/.test(item.label))) return [block];
  return block.items.flatMap(item => {
    const blocks = structuredClone(item.blocks);
    if (blocks[0]?.type === "paragraph")
      blocks[0].runs.unshift({ type: "text", text: `${item.label} ` });
    else blocks.unshift({ type: "paragraph", runs: [{ type: "text", text: `${item.label} ` }] });
    return blocks;
  });
}

// Split only the text projection. Adopt the original Document blocks and math
// runs afterwards; OCR text is never reparsed as a provider's question JSON.
export function readRecognizedPage(page, { section }) {
  const entries = [], fragments = [];
  const fragment = (text, locations) => {
    for (let i = 0; i < text.length; i += 20000)
      fragments.push({ id: extractionId(page.resultId, "unassigned", fragments.length),
        text: text.slice(i, i + 20000), locations, disposition: "unassigned" });
  };
  let answerPage = false, sawQuestion = false, cursor = 0, unresolvedTable = false;
  for (const raw of page.blocks) {
    const location = { ...page.location, box: raw.box };
    if (!sawQuestion && answerHeading.test(pageHeading(raw.text))) answerPage = true;
    if (["header", "footer", "number", "header_image", "footer_image"].includes(raw.block_label) ||
        /^\s*第\s*\d+\s*页/.test(raw.text) && ["paragraph_title", "doc_title"].includes(raw.block_label) ||
        answerPage && answerHeading.test(pageHeading(raw.text))) continue;
    if (raw.document.blocks.length === 1 && ["heading", "paragraph"].includes(raw.document.blocks[0].type) &&
        /^\s*(?:教学环节|师生活动|教师活动|设计点评)\s*[:：][^\r\n]*$/.test(raw.text)) {
      fragment(raw.text, [location]);
      continue;
    }
    for (let block of raw.document.blocks.flatMap(numberedBlocks)) {
      if (block.type === "table") {
        // No cell geometry proves a question/teacher-activity boundary here.
        // Keep the original structured table in the immutable machine result.
        fragment(documentText({ version: 2, blocks: [block] }), [location]);
        unresolvedTable = true;
        continue;
      }
      let text = block.runs ? paragraphText(block)
        : block.type === "math" ? block.latex.replace(/[\r\n]/g, " ")
        : block.type === "image" ? "[配图]"
        : documentText({ version: 2, blocks: [block] });
      const continuation = !entries.length && !answerPage && text.match(continuationHeading);
      const continues = continuation ? continuation[1] ?? continuation[2] : "";
      if (continues && block.runs) {
        // An explicit continuation supplies its own label. Keep its original
        // heading in the adopted document and only add a parser boundary.
        const prefix = `${continues}. `;
        block = {...block, runs: [{type: "text", text: prefix}, ...block.runs]};
        text = prefix + text;
      }
      sawQuestion ||= questionStart.test(text);
      entries.push({ block, text, start: cursor, end: cursor + length(text), location,
        rawId: raw.block_id ?? raw.rawIndex, continues });
      cursor += length(text) + 1;
    }
  }
  const text = entries.map(entry => entry.text).join("\n");
  const parsed = nativeText(text);
  const within = ranges => entries.filter(entry => ranges.some(range =>
    entry.start < range.end && entry.end > range.start));
  const anchors = parsed.drafts.map(draft => ({ draft,
    entry: within(draft.parts[0].locations)[0] }));
  const singleColumn = anchors.every(({ entry }) => entry?.location.box) &&
    Math.max(...anchors.map(({ entry }) => entry.location.box.x)) -
      Math.min(...anchors.map(({ entry }) => entry.location.box.x)) <= 0.12;
  const canBindFigure = (entry, draft) => {
    const anchor = anchors.find(a => a.draft === draft)?.entry;
    if (!singleColumn || !questionStart.test(anchor?.text ?? "") || !entry.location.box) return false;
    const own = anchor.location.box, figure = entry.location.box;
    const next = anchors.filter(a => a.entry.location.box.y > own.y)
      .sort((a, b) => a.entry.location.box.y - b.entry.location.box.y)[0]?.entry.location.box;
    return anchors.filter(a => a.entry.location.box.y === own.y).length === 1 &&
      anchors.filter(a => questionLabel(a.draft.title) === questionLabel(draft.title)).length === 1 &&
      figure.y >= own.y + own.height && figure.y + figure.height <= (next?.y ?? 1) &&
      Math.min(own.x + own.width, figure.x + figure.width) > Math.max(own.x, figure.x);
  };
  function adopt(draft, role) {
    const ranges = draft.parts.filter(part => part.role === role).flatMap(part => part.locations);
    const selected = within(ranges), blocks = [], accepted = [], figures = [];
    let unassignedFigure = false;
    for (const entry of selected) {
      if (entry.block.type === "image" && !canBindFigure(entry, draft)) {
        fragment("未确定归属的配图，请对照原稿选区。", [entry.location]);
        unassignedFigure = true;
        continue;
      }
      for (const range of ranges) {
        let start = Math.max(0, range.start - entry.start);
        const end = Math.min(length(entry.text), range.end - entry.start);
        if (end <= start) continue;
        if (role === "body" && entry === selected[0]) {
          const match = slice(entry.text, start, end).match(questionStart);
          if (match) start += length(match[0]) - length(match[2]);
        }
        const block = structuredClone(entry.block);
        if (block.runs) {
          let offset = 0;
          block.runs = block.runs.flatMap(run => {
            const value = run.text ?? run.latex, size = length(value);
            const from = Math.max(0, start - offset), to = Math.min(size, end - offset);
            offset += size;
            if (to <= from) return [];
            if (run.type === "math") {
              if (slice(value, 0, from).trim() || slice(value, to).trim())
                throw new Error("Question boundary cuts a math run");
              return [run];
            }
            return [{ ...run, text: slice(value, from, to) }];
          });
          if (!block.runs.length) continue;
        }
        blocks.push(block);
        accepted.push(entry);
        if (block.type === "image") figures.push(entry.location);
      }
    }
    return { document: { version: 2, blocks }, entries: accepted, figures, unassignedFigure };
  }
  const records = [];
  function record(draft, role, adopted) {
    if (!adopted.document.blocks.length) return;
    const localIssues = page.issues.filter(issue => issue.blockId == null ||
      adopted.entries.some(entry => entry.rawId === issue.blockId));
    const continues = role === "question" ? adopted.entries[0]?.continues : "";
    records.push({ id: extractionId(page.resultId, records.length), role: continues ? "continuation" : role,
      label: draft.title, section, group: "", continues: continues || "",
      text: documentText(adopted.document), document: adopted.document,
      locations: uniqueLocations(adopted.entries), figureLocations: adopted.figures,
      doubts: [...localIssues.map(issue => issue.detail), ...(adopted.unassignedFigure ? ["配图归属未确定"] : [])],
      issueCodes: [...new Set(localIssues.map(issue => issue.code === "unparsed-math" ? "uncertain-formula" : "uncertain-text")),
        ...(adopted.unassignedFigure ? ["missing-figure"] : [])],
    });
  }
  for (const draft of parsed.drafts) {
    record(draft, answerPage ? "answer" : "question", adopt(draft, "body"));
    if (draft.parts.some(part => part.role === "solution")) record(draft, "answer", adopt(draft, "solution"));
  }
  for (const item of parsed.fragments) fragment(item.text, uniqueLocations(within(item.locations)));
  // Images not represented by a raw text block remain visible through their
  // source page instead of being attached to an arbitrary last question.
  const represented = new Set(page.blocks.flatMap(block => images(block.document)));
  if (images(page.document).some(id => !represented.has(id)))
    fragment("页面中另有未确定归属的配图，请对照原稿。", [page.location]);
  return { drafts: [], fragments, records,
    ...(unresolvedTable ? {code: "invalid-output", issueDetail: "表格中的题目、活动或点评尚未可靠区分，已保留在未分配内容中，请对照原稿校对。"} : {}),
    recognition: { resultId: page.resultId, revision: page.revision, rawFileId: page.rawFileId } };
}
