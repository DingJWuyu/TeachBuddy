import { invalidInput, materialsError } from "../../workbench/problems.js";
import { nativeMathRuns, normalizeMath } from "./native-math.js";

export const emptyDocument = () => ({ version: 2, blocks: [] });
import { documentText, walkBlocks, images } from "../../workbench/content/document.js";
export function validateQuestionContent(content, p, q, { draft = false } = {}) {
  for (const field of ["body", "solution"]) {
    content.validate(p, q[field]);
    walkBlocks(q[field].blocks, (b) => {
      if (b.type === "teacher-note")
        throw invalidInput("/" + field, "out-of-range");
    });
  }
  for (const fragment of q.noteFragments ?? []) content.validate(p, fragment.document);
  if (!documentText(q.body).trim() && !images(q.body).length)
    throw invalidInput("/body", "empty-content");
  const answered = Boolean(
    documentText(q.solution).trim() || images(q.solution).length,
  );
  if (
    (q.answerStatus === "absent" && answered) ||
    (q.answerStatus === "present" && !answered) ||
    (!draft && q.answerStatus === "unresolved")
  )
    throw invalidInput("/answerStatus", "out-of-range");
}
export function validateTaxonomyIds(t, q) {
  if (q.typeId !== null && !t.types.some((x) => x.id === q.typeId))
    throw materialsError("invalid-taxonomy", 422, "/typeId");
  if (
    new Set(q.tagIds).size !== q.tagIds.length ||
    q.tagIds.some((id) => !t.tags.some((x) => x.id === id))
  )
    throw materialsError("invalid-taxonomy", 422, "/tagIds");
}
export function textDocument(text) {
  function paragraph(line) {
    const runs = [],
      regex = /\$([^$]+)\$|\\\((.*?)\\\)/g;
    let end = 0;
    for (const m of line.matchAll(regex)) {
      if (m.index > end) runs.push(...nativeMathRuns(line.slice(end, m.index)));
      runs.push({ type: "math", latex: normalizeMath(m[1] ?? m[2]) });
      end = m.index + m[0].length;
    }
    if (end < line.length) runs.push(...nativeMathRuns(line.slice(end)));
    return { type: "paragraph", runs };
  }
  return {
    version: 2,
    blocks: text
      .replaceAll("\uFFFC", "")
      .split(/\r?\n/)
      .filter((x) => x.trim())
      .map((line) => {
        const options = /^\s*[A-Z][.．、]\s/.test(line);
        const subquestions = /^\s*[（(]\d+[)）]/.test(line);
        if (options || subquestions) {
          const pattern = options
            ? /(?:^|\s+)([A-Z])[.．、]\s*/g
            : /(?:^|[；;]\s*|\s+)[（(](\d+)[)）]/g;
          const matches = [...line.matchAll(pattern)];
          if (matches.length > 1)
            return {
              type: "list",
              role: options ? "options" : "subquestions",
              items: matches.map((m, i) => ({
                label: m[1],
                blocks: [
                  paragraph(
                    line
                      .slice(m.index + m[0].length, matches[i + 1]?.index)
                      .replace(/[；;]\s*$/, ""),
                  ),
                ],
              })),
            };
        }
        return paragraph(line);
      }),
  };
}
