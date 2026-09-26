import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  emptyDocument,
  textDocument,
  documentText,
} from "./materials-content.js";

// Stable identities belong to a source unit and fragment, never to a question number.
export function extractionId(...values) {
  const h = createHash("sha256").update(JSON.stringify(values)).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const doubt = (id, code, field, locations) => ({
  id: extractionId(id, code, field),
  code,
  field,
  locations,
  resolution: "open",
});
// Normalize identifiers only. Original text and source offsets stay untouched.
export const questionLabel = (value) => value.normalize("NFKC").trim()
  .replace(/\s+/g, "").replace(/[.、:)]$/, "").replace(/^q(?=\d)/i, "");
const matches = (q, f, target = f.label) =>
  Boolean(q.section || q.group) &&
  q.section === f.section &&
  q.group === f.group &&
  questionLabel(q.label) === questionLabel(target);
const unassigned = (f) => ({
  id: f.id,
  text: f.text,
  locations: f.locations,
  disposition: "unassigned",
});

export function readTranscription(rows, locations) {
  const records = [],
    fragments = [];
  let invalid = false;
  for (const [index, row] of rows.entries()) {
    const id = extractionId(locations, index);
    if (
      !row ||
      !["question", "answer", "continuation", "other"].includes(row.role) ||
      !["label", "section", "group", "text", "continues"].every(
        (k) => typeof row[k] === "string",
      ) ||
      !Array.isArray(row.doubts) ||
      !Array.isArray(row.content) ||
      !row.content.length ||
      !row.content.every(
        (x) =>
          x &&
          Object.keys(x).length === 1 &&
          ["text", "latex"].some(
            (k) => typeof x[k] === "string" && x[k].trim(),
          ),
      )
    ) {
      invalid = true;
      fragments.push({
        id,
        text: JSON.stringify(row).slice(0, 20000),
        locations,
        disposition: "unassigned",
      });
      continue;
    }
    const document = emptyDocument();
    // Preserve explicit LaTeX runs without inferring missing mathematics from prose.
    for (const item of row.content) {
      if (item.latex !== undefined) {
        const last = document.blocks.at(-1);
        const run = { type: "math", latex: item.latex };
        if (last?.type === "paragraph") last.runs.push(run);
        else document.blocks.push({ type: "paragraph", runs: [run] });
      } else {
        const blocks = textDocument(item.text).blocks;
        if (
          document.blocks.at(-1)?.type === "paragraph" &&
          blocks[0]?.type === "paragraph"
        )
          document.blocks.at(-1).runs.push(...blocks.shift().runs);
        document.blocks.push(...blocks);
      }
    }
    records.push({
      id,
      role: row.role,
      label: row.label,
      section: row.section,
      group: row.group,
      text: row.text,
      continues: row.continues,
      doubts: row.doubts,
      document,
      locations,
    });
  }
  return { records, fragments, invalid };
}

export function mergeExtractions(results, complete) {
  const drafts = [],
    fragments = [],
    records = [];
  for (const result of Object.values(results)) {
    fragments.push(...structuredClone(result.fragments));
    records.push(...structuredClone(result.records ?? []));
    for (const original of result.drafts) {
      const d = structuredClone(original);
      if (!complete && d.answerStatus === "absent") {
        d.answerStatus = "unresolved";
        d.issues.push(
          doubt(d.id, "incomplete-answer", "/solution", d.parts[0].locations),
        );
      }
      drafts.push(d);
    }
  }
  const questions = records.filter((f) => f.role === "question");
  const answers = records.filter((f) => f.role === "answer");
  const continuations = records.filter((f) => f.role === "continuation");
  const used = new Set();
  for (const q of questions) {
    const d = {
      id: q.id,
      title: q.label.slice(0, 200),
      body: structuredClone(q.document),
      solution: emptyDocument(),
      answerStatus: "unresolved",
      typeId: null,
      tagIds: [],
      parts: [{ role: "body", locations: q.locations }],
      issues: [doubt(q.id, "unverified-location", "/parts", q.locations)],
      disposition: "pending",
      questionId: null,
    };
    const append = (f, role) => {
      d[role].blocks.push(...structuredClone(f.document.blocks));
      d.parts.push({ role, locations: f.locations });
      if (f.doubts.length)
        d.issues.push(
          doubt(
            f.id,
            role === "solution" ? "incomplete-answer" : "uncertain-text",
            "/" + role,
            f.locations,
          ),
        );
      used.add(f.id);
    };
    const tails = continuations.filter(
      (f) => f.continues && matches(q, f, f.continues),
    );
    if (
      tails.length === 1 &&
      questions.filter((x) => matches(x, tails[0], tails[0].continues))
        .length === 1
    )
      append(tails[0], "body");
    else if (tails.length)
      d.issues.push(doubt(q.id, "split-boundary", "/body", q.locations));
    const candidates = answers.filter((f) => matches(q, f));
    const a = candidates[0];
    if (
      candidates.length === 1 &&
      questions.filter((x) => matches(x, a)).length === 1
    ) {
      append(a, "solution");
      d.answerStatus = a.doubts.length ? "unresolved" : "present";
      if (/^(?:原稿)?未提供答案(?:解析)?[。.]?$/.test(a.text.trim())) {
        if (complete && !a.doubts.length) {
          d.solution = emptyDocument();
          d.answerStatus = "absent";
        } else d.answerStatus = "unresolved";
      }
    } else if (
      complete &&
      !answers.some((f) => !f.label || questionLabel(f.label) === questionLabel(q.label)) &&
      !tails.some((f) => !used.has(f.id))
    )
      d.answerStatus = "absent";
    if (d.answerStatus === "unresolved")
      d.issues.push(doubt(q.id, "incomplete-answer", "/solution", q.locations));
    if (q.doubts.length)
      d.issues.push(doubt(q.id, "uncertain-text", "/body", q.locations));
    if (q.figure) {
      d.body.blocks.push({
        type: "image",
        fileId: q.figure.fileId,
        alt: "本原稿配图，需对照核验标签完整性",
        widthMm: 100,
      });
      d.parts.push({ role: "figure", locations: [q.figure.location] });
    }
    if (!q.figure && /如图|[配附]图|\[图[:：]|图示/.test(documentText(d.body)))
      d.issues.push(doubt(q.id, "missing-figure", "/body", q.locations));
    drafts.push(d);
  }
  for (const f of records)
    if (f.role !== "question" && !used.has(f.id)) fragments.push(unassigned(f));
  return { drafts, fragments };
}

// Only untouched machine projections may be replaced. Removed or edited human
// versions survive; a changed machine candidate is offered separately once.
export function reconcileExtraction(material, task, next) {
  for (const key of ["drafts", "fragments"]) {
    const previous = new Map(
      (task.projection?.[key] ?? []).map((x) => [x.id, x]),
    );
    const incoming = new Map(next[key].map((x) => [x.id, x]));
    const output = [];
    for (const current of material[key]) {
      const old = previous.get(current.id),
        fresh = incoming.get(current.id);
      if (old && isDeepStrictEqual(current, old)) {
        if (fresh) output.push(fresh);
      } else {
        output.push(current);
        if (fresh && old && !isDeepStrictEqual(fresh, old)) {
          const candidate = { ...fresh, id: extractionId(fresh.id, fresh) };
          if (!material[key].some((x) => x.id === candidate.id))
            output.push(candidate);
        }
      }
      incoming.delete(current.id);
    }
    for (const fresh of incoming.values())
      if (!previous.has(fresh.id)) output.push(fresh);
    material[key] = output;
  }
  task.projection = structuredClone(next);
}
