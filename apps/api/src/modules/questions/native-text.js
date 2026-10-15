import { randomUUID } from "node:crypto";
import { documentText } from "../../workbench/content/document.js";
import { textDocument } from "./materials-content.js";
import { questionLabel } from "./extraction-fragments.js";

export const questionStart = /^\s*(Q\s*[0-9０-９]+(?=\s*$)|(?:Q\s*)?[0-9０-９]+(?:[.．](?![0-9０-９])|[、:：)）])|例\s*[0-9０-９]+[:：.、]?|练习\s*[0-9０-９]+[:：.、]?)[ \t]*(.*)$/i;
export const answerHeading = /^\s*(?:【.*(?:答案|解析).*】|(?:第.+页[:：]\s*)?(?:已有答案(?:解析)?|原有答案|(?:原有)?(?:参考答案|答案解析|参考解答)|答案|解析|解答))\s*[:：]?\s*$/;
export const continuationHeading = /^(?:续第\s*([0-9０-９]+)\s*题|第\s*([0-9０-９]+)\s*题[（(]续[）)])[ \t]*[:：]?[ \t]*(?:\r?\n|$)/;
const inlineAnswer = /^\s*(?:参考答案|答案|解析|解答)\s*[:：]\s*(.*)$/;
export function nativeText(text, location) {
  const lines = [];
  let cursor = 0;
  for (const line of text.split("\n")) {
    lines.push({ text: line, start: cursor, end: cursor + [...line].length });
    cursor += [...line].length + 1;
  }
  const drafts = [],
    fragments = [],
    answers = [];
  let group = null,
    answer = false,
    answerSection = false;
  const answerHeadingIndex = lines.findIndex(line => answerHeading.test(line.text));
  const numbered = lines.slice(0, answerHeadingIndex < 0 ? lines.length : answerHeadingIndex)
    .some(line => questionStart.test(line.text));
  const locate = (start, end) => location ?? { kind: "text", start, end };
  function finish() {
    if (!group) return;
    const body = group.body.join("\n").trim(),
      solution = group.solution.join("\n").trim();
    if (body) {
      const ranges = (start, end) => {
        const locations = [];
        for (const excluded of group.excluded ?? []) {
          if (excluded.start >= end || excluded.end <= start) continue;
          if (excluded.start > start)
            locations.push(locate(start, excluded.start));
          start = Math.max(start, excluded.end);
        }
        if (end > start) locations.push(locate(start, end));
        return locations;
      };
      const locations = ranges(group.start, group.answerStart ?? group.end);
      if (answerSection) answers.push({ ...group, text: body, locations });
      else
        drafts.push({
          id: randomUUID(),
          title: group.title,
          body: textDocument(body),
          solution: textDocument(solution),
          answerStatus: solution ? "present" : "absent",
          typeId: null,
          tagIds: [],
          parts: [
            { role: "body", locations },
            ...(group.answerStart !== undefined
              ? [
                  {
                    role: "solution",
                    locations: ranges(group.answerStart, group.end),
                  },
                ]
              : []),
          ],
          issues: [
            {
              id: randomUUID(),
              code: "split-boundary",
              field: "/body",
              locations,
              resolution: "open",
            },
          ],
          disposition: "pending",
          questionId: null,
        });
    }
    group = null;
  }
  for (const [index, line] of lines.entries()) {
    if (answerHeading.test(line.text)) {
      // An answer section can introduce unknown answers before known labels.
      // Evidence belongs to this heading only, never a later answer section.
      const following = [];
      for (const item of lines.slice(index + 1)) {
        if (answerHeading.test(item.text)) break;
        following.push(item);
      }
      const next = following.find(item => item.text.trim());
      const knownLabels = new Set([...drafts, ...(group ? [group] : [])].map(item => questionLabel(item.title)));
      const resumesKnownLabel = following.some(item => {
        const numbered = item.text.match(questionStart);
        return numbered && knownLabels.has(questionLabel(numbered[1]));
      });
      if (group && !answerSection && /^\s*(?:答案|解析|解答)\s*[:：]?\s*$/.test(line.text) && !questionStart.test(next?.text ?? "") && !resumesKnownLabel) {
        answer = true;
        group.answerStart ??= line.start;
        continue;
      }
      finish();
      answerSection = true;
      continue;
    }
    if (/^\s*【第.+页.*】\s*$/.test(line.text)) {
      finish();
      continue;
    }
    const match = line.text.match(questionStart);
    if (match) {
      finish();
      group = {
        title: match[1].trim(),
        body: [match[2]],
        solution: [],
        start: line.start,
        end: line.end,
      };
      answer = false;
    } else if (
      /^\s*(?:教师活动|教学点评|教学建议|(?:说明|注释|编者注)[:：]|(?:(?:本页|本段|本文)\s*)?(?:保留|转换|导出|格式说明).*?(?:OMML|LaTeX|文字层|公式源|公式转成图片))/.test(
        line.text,
      )
    ) {
      if (/^\s*(?:教师活动|教学点评|教学建议)/.test(line.text)) finish();
      else if (group)
        (group.excluded ??= []).push({ start: line.start, end: line.end + 1 });
      if (line.text.trim())
        fragments.push({
          id: randomUUID(),
          text: line.text,
          locations: [locate(line.start, line.end)],
          disposition: "unassigned",
        });
    } else if (group || (!numbered && !answerSection && line.text.trim() && !inlineAnswer.test(line.text))) {
      if (!group) {
        group = { title: "未编号题目", body: [], solution: [], start: line.start, end: line.end };
        answer = false;
      }
      const a = line.text.match(inlineAnswer);
      if (a) {
        answer = true;
        group.answerStart ??= line.start;
        group.solution.push(a[1]);
      } else (answer ? group.solution : group.body).push(line.text);
      if (line.text.trim()) group.end = line.end;
    } else if (line.text.trim())
      fragments.push({
        id: randomUUID(),
        text: line.text,
        locations: [locate(line.start, line.end)],
        disposition: "unassigned",
      });
  }
  finish();
  for (const a of answers) {
    const candidates = drafts.filter((d) => questionLabel(d.title) === questionLabel(a.title));
    if (
      candidates.length !== 1 ||
      answers.filter((x) => questionLabel(x.title) === questionLabel(a.title)).length !== 1
    ) {
      for (const d of candidates) {
        d.answerStatus = "unresolved";
        d.issues.push({
          id: randomUUID(),
          code: "incomplete-answer",
          field: "/solution",
          locations: a.locations,
          resolution: "open",
        });
      }
      fragments.push({
        id: randomUUID(),
        text: a.text,
        locations: a.locations,
        disposition: "unassigned",
      });
      continue;
    }
    const d = candidates[0];
    d.parts.push({ role: "solution", locations: a.locations });
    if (!/^(?:原稿)?未提供答案(?:解析)?[。.]?$/.test(a.text)) {
      d.solution = textDocument(a.text);
      d.answerStatus = "present";
    }
  }
  for (const d of drafts) {
    const body = documentText(d.body);
    if (/如图|[配附]图|\[图[:：]|图示/.test(body))
      d.issues.push({
        id: randomUUID(),
        code: "missing-figure",
        field: "/body",
        locations: d.parts[0].locations,
        resolution: "open",
      });
    if (
      /[√²₁₂≥≤]|log[_(]|f\(x\)=/.test(body) &&
      !d.body.blocks.some((b) => b.runs?.some((r) => r.type === "math"))
    )
      d.issues.push({
        id: randomUUID(),
        code: "uncertain-formula",
        field: "/body",
        locations: d.parts[0].locations,
        resolution: "open",
      });
  }
  return { drafts, fragments };
}
